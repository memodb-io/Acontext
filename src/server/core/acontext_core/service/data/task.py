from sqlalchemy import String
from typing import List, Optional
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import ARRAY
from ...schema.orm import Task, Message
from ...schema.result import Result
from ...schema.utils import asUUID
from ...schema.session.task import TaskSchema


async def fetch_planning_task(
    db_session: AsyncSession, session_id: asUUID
) -> Result[TaskSchema | None]:
    query = (
        select(Task)
        .where(Task.session_id == session_id)
        .options(selectinload(Task.messages))
        .where(Task.is_planning == True)
    )
    result = await db_session.execute(query)
    planning = result.scalars().first()
    if planning is None:
        return Result.resolve(None)
    return Result.resolve(
        TaskSchema(
            id=planning.id,
            session_id=planning.session_id,
            order=planning.order,
            status=planning.status,
            data=planning.data,
            space_digested=planning.space_digested,
            raw_message_ids=[
                msg.id for msg in sorted(planning.messages, key=lambda m: m.created_at)
            ],
        )
    )


async def fetch_task(db_session: AsyncSession, task_id: asUUID) -> Result[TaskSchema]:
    query = select(Task).where(Task.id == task_id).options(selectinload(Task.messages))
    result = await db_session.execute(query)
    task = result.scalars().first()
    if task is None:
        return Result.reject(f"Task {task_id} not found")
    return Result.resolve(
        TaskSchema(
            id=task.id,
            session_id=task.session_id,
            order=task.order,
            status=task.status,
            data=task.data,
            space_digested=task.space_digested,
            raw_message_ids=[
                msg.id for msg in sorted(task.messages, key=lambda m: m.created_at)
            ],
        )
    )


async def fetch_current_tasks(
    db_session: AsyncSession, session_id: asUUID, status: str = None
) -> Result[List[TaskSchema]]:
    query = (
        select(Task)
        .where(Task.session_id == session_id)
        .where(Task.is_planning == False)
        .options(selectinload(Task.messages))  # Eagerly load related messages
        .order_by(Task.order.asc())
    )
    if status:
        query = query.where(Task.status == status)
    result = await db_session.execute(query)
    tasks = list(result.scalars().all())
    tasks_d = [
        TaskSchema(
            id=t.id,
            session_id=t.session_id,
            order=t.order,
            status=t.status,
            data=t.data,
            space_digested=t.space_digested,
            raw_message_ids=[
                msg.id for msg in sorted(t.messages, key=lambda m: m.created_at)
            ],
        )
        for t in tasks
    ]
    return Result.resolve(tasks_d)


async def update_task(
    db_session: AsyncSession,
    task_id: asUUID,
    status: str = None,
    order: int = None,
    patch_data: dict = None,
    data: dict = None,
) -> Result[Task]:
    # Fetch the task to update
    query = select(Task).where(Task.id == task_id)
    result = await db_session.execute(query)
    task = result.scalars().first()

    if task is None:
        return Result.reject(f"Task {task_id} not found")

    # Update only the non-None parameters
    if status is not None:
        task.status = status
    if order is not None:
        task.order = order

    if data is not None:
        task.data = data
    elif patch_data is not None:
        new_data = task.data.copy()
        new_data.update(patch_data)
        task.data = new_data

    await db_session.flush()
    # Changes will be committed when the session context exits
    return Result.resolve(task)


async def set_task_space_digested(
    db_session: AsyncSession,
    task_id: asUUID,
) -> Result[bool]:
    # Fetch the task to check current space_digested status
    query = select(Task).where(Task.id == task_id)
    result = await db_session.execute(query)
    task = result.scalars().first()

    if task is None:
        return Result.reject(f"Task {task_id} not found")

    # Return True if space_digested is already True (no update needed)
    if task.space_digested:
        return Result.resolve(True)

    # Update space_digested to True
    task.space_digested = True
    await db_session.flush()

    # Return False to indicate that space_digested was previously False
    return Result.resolve(False)


async def insert_task(
    db_session: AsyncSession,
    project_id: asUUID,
    session_id: asUUID,
    after_order: int,
    data: dict,
    status: str = "pending",
) -> Result[Task]:
    """This function will cause the session' tasks row be locked for update, make sure the DB session will be closed soonly after this function is called"""
    # Lock all tasks in this session to prevent concurrent modifications
    lock_query = (
        select(Task.id)
        .where(Task.session_id == session_id)
        .with_for_update()  # This locks the rows
    )
    await db_session.execute(lock_query)

    # Step 1: Move all tasks that need to be shifted to temporary negative values
    assert after_order >= 0
    temp_update_stmt = (
        update(Task)
        .where(Task.session_id == session_id)
        .where(Task.order > after_order)
        .values(order=-Task.order)
    )
    await db_session.execute(temp_update_stmt)
    await db_session.flush()

    # Step 2: Update them back to positive values, incremented by 1
    final_update_stmt = (
        update(Task)
        .where(Task.session_id == session_id)
        .where(Task.order < 0)
        .values(order=-Task.order + 1)
    )
    await db_session.execute(final_update_stmt)
    await db_session.flush()

    # Step 3: Create new task
    task = Task(
        session_id=session_id,
        project_id=project_id,
        order=after_order + 1,
        data=data,
        status=status,
    )

    db_session.add(task)
    await db_session.flush()
    return Result.resolve(task)


async def delete_task(db_session: AsyncSession, task_id: asUUID) -> Result[None]:
    # Fetch the task to delete
    await db_session.execute(delete(Task).where(Task.id == task_id))
    return Result.resolve(None)


async def append_messages_to_task(
    db_session: AsyncSession,
    message_ids: list[asUUID],
    task_id: asUUID,
) -> Result[None]:
    # set those messages' task_id to task_id
    await db_session.execute(
        update(Message).where(Message.id.in_(message_ids)).values(task_id=task_id)
    )
    await db_session.flush()
    return Result.resolve(None)


async def append_progress_to_task(
    db_session: AsyncSession,
    task_id: asUUID,
    progress: str,
    user_preference: str = None,
) -> Result[None]:
    # append the progress to the task
    # Use coalesce to handle NULL, then append to the array
    assert progress is not None

    # Fetch the task
    query = select(Task).where(Task.id == task_id)
    result = await db_session.execute(query)
    task = result.scalars().first()

    if task is None:
        return Result.reject(f"Task {task_id} not found")

    # Get current data and append progress
    if "progresses" not in task.data:
        task.data["progresses"] = []
    task.data["progresses"].append(progress)

    if user_preference is not None:
        if "user_preferences" not in task.data:
            task.data["user_preferences"] = []
        task.data["user_preferences"].append(user_preference)

    flag_modified(task, "data")

    await db_session.flush()
    return Result.resolve(None)


async def append_messages_to_planning_section(
    db_session: AsyncSession,
    project_id: asUUID,
    session_id: asUUID,
    message_ids: list[asUUID],
) -> Result[None]:
    # set those messages' task_id to task_id
    query = (
        select(Task)
        .where(Task.session_id == session_id)
        .where(Task.is_planning == True)
    )
    result = await db_session.execute(query)
    planning_task = result.scalars().first()
    if planning_task is None:
        # add planning section
        planning_task = Task(
            project_id=project_id,
            session_id=session_id,
            order=0,
            data={"task_description": "collecting planning&requirments"},
            status="pending",
            is_planning=True,
        )
        db_session.add(planning_task)
        await db_session.flush()
    planning_section_id = planning_task.id
    r = await append_messages_to_task(db_session, message_ids, planning_section_id)
    return r
