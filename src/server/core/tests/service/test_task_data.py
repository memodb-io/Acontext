import pytest
import uuid
from sqlalchemy import select, func
from acontext_core.service.data.task import (
    fetch_current_tasks,
    update_task,
    insert_task,
    delete_task,
    append_progress_to_task,
    append_sop_thinking_to_task,
)
from acontext_core.schema.orm import Task, Project, Space, Session
from acontext_core.schema.result import Result
from acontext_core.infra.db import DatabaseClient


class TestFetchCurrentTasks:
    @pytest.mark.asyncio
    async def test_fetch_all_tasks_success(self):
        """Test fetching all tasks for a session"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create sample tasks
            tasks_data = [
                {
                    "session_id": test_session.id,
                    "order": 1,
                    "data": {"task_description": "First task"},
                    "status": "pending",
                },
                {
                    "session_id": test_session.id,
                    "order": 2,
                    "data": {"task_description": "Second task"},
                    "status": "running",
                },
                {
                    "session_id": test_session.id,
                    "order": 3,
                    "data": {"task_description": "Third task"},
                    "status": "success",
                },
            ]

            for data in tasks_data:
                task = Task(project_id=project.id, **data)
                session.add(task)

            await session.flush()

            # Test the function
            result = await fetch_current_tasks(session, test_session.id)

            assert isinstance(result, Result)
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert len(data) == 3

            # Check if tasks are ordered by order
            assert data[0].order == 1
            assert data[1].order == 2
            assert data[2].order == 3

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_fetch_tasks_with_status_filter(self):
        """Test fetching tasks with status filter"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Clean up any existing project with this key
            existing = await session.execute(
                select(Project).where(Project.secret_key_hmac == "test_key_hmac2")
            )
            existing_project = existing.scalars().first()
            if existing_project:
                await session.delete(existing_project)
                await session.flush()

            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac2", secret_key_hash_phc="test_key_hash2"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create sample tasks with different statuses
            task1 = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Task 1"},
                status="pending",
            )
            task2 = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=2,
                data={"task_description": "Task 2"},
                status="running",
            )
            session.add_all([task1, task2])
            await session.flush()

            # Test filtering by status
            result = await fetch_current_tasks(
                session, test_session.id, status="pending"
            )

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert len(data) == 1
            assert data[0].status == "pending"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_fetch_tasks_no_results(self):
        """Test fetching tasks for non-existent session"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            non_existent_session_id = uuid.uuid4()

            result = await fetch_current_tasks(session, non_existent_session_id)

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert len(data) == 0


class TestUpdateTask:
    @pytest.mark.asyncio
    async def test_update_status_success(self):
        """Test updating task status"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Clean up any existing project with this key
            existing = await session.execute(
                select(Project).where(Project.secret_key_hmac == "test_key_hmac3")
            )
            existing_project = existing.scalars().first()
            if existing_project:
                await session.delete(existing_project)
                await session.flush()

            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac3", secret_key_hash_phc="test_key_hash3"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test task"},
                status="pending",
            )
            session.add(task)
            await session.flush()

            original_status = task.status

            result = await update_task(session, task.id, status="success")

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.status == "success"
            assert data.status != original_status

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_update_order_success(self):
        """Test updating task order"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_update_order", secret_key_hash_phc="test_key_hash_update_order"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test task"},
                status="pending",
            )
            session.add(task)
            await session.flush()

            original_order = task.order
            new_order = 10

            result = await update_task(session, task.id, order=new_order)

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.order == new_order
            assert data.order != original_order

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_update_data_success(self):
        """Test updating task data"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac5", secret_key_hash_phc="test_key_hash5"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "original_task"},
                status="pending",
            )
            session.add(task)
            await session.flush()

            new_data = {"task_description": "updated_task"}

            result = await update_task(session, task.id, data=new_data)

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.data == new_data

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_update_multiple_fields(self):
        """Test updating multiple task fields at once"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac6", secret_key_hash_phc="test_key_hash6"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Original task"},
                status="pending",
            )
            session.add(task)
            await session.flush()

            new_status = "running"
            new_order = 5
            new_data = {
                "task_description": "Multi update task",
                "progresses": ["Started"],
            }

            result = await update_task(
                session, task.id, status=new_status, order=new_order, data=new_data
            )

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.status == new_status
            assert data.order == new_order
            assert data.data == new_data

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_update_nonexistent_task(self):
        """Test updating a task that doesn't exist"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            non_existent_task_id = uuid.uuid4()

            result = await update_task(session, non_existent_task_id, status="success")

            data, error = result.unpack()
            assert data is None
            assert error is not None
            assert f"Task {non_existent_task_id} not found" in error.errmsg

    @pytest.mark.asyncio
    async def test_update_task_with_none_values(self):
        """Test updating task with None values (should not change anything)"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac7", secret_key_hash_phc="test_key_hash7"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test task"},
                status="pending",
            )
            session.add(task)
            await session.flush()

            original_status = task.status
            original_order = task.order
            original_data = task.data

            result = await update_task(
                session, task.id, status=None, order=None, data=None
            )

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.status == original_status
            assert data.order == original_order
            assert data.data == original_data

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_update_task_patch_data_success(self):
        """Test updating task using patch_data for partial updates"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_patch",
                secret_key_hash_phc="test_key_hash_patch",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create task with initial data
            initial_data = {
                "task_description": "Original task",
                "progresses": ["Step 1", "Step 2"],
            }
            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data=initial_data,
                status="pending",
            )
            session.add(task)
            await session.flush()

            # Test 1: Simple patch_data update
            patch_data = {"task_description": "Updated task description"}
            result = await update_task(session, task.id, patch_data=patch_data)

            data, error = result.unpack()
            assert error is None
            assert data is not None

            # Verify the patched field is updated
            assert data.data["task_description"] == "Updated task description"
            # Verify progresses remain unchanged
            assert data.data["progresses"] == initial_data["progresses"]

            # Test 2: Update progresses via patch_data
            patch_data = {"progresses": ["Step 1", "Step 2", "Step 3"]}
            result = await update_task(session, task.id, patch_data=patch_data)

            data, error = result.unpack()
            assert error is None
            assert data is not None

            # Verify progresses updated
            assert data.data["progresses"] == ["Step 1", "Step 2", "Step 3"]
            # Verify task_description remains unchanged
            assert data.data["task_description"] == "Updated task description"

            # Test 3: Verify data parameter takes precedence over patch_data
            complete_new_data = {"task_description": "Completely new description"}
            patch_data = {"task_description": "Should be ignored"}

            result = await update_task(
                session, task.id, data=complete_new_data, patch_data=patch_data
            )

            data, error = result.unpack()
            assert error is None
            assert data is not None

            # Verify data parameter took precedence
            assert data.data == complete_new_data

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_update_task_patch_data_with_status_and_order(self):
        """Test updating task using patch_data combined with status and order updates"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_patch2",
                secret_key_hash_phc="test_key_hash_patch2",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Original task", "progresses": ["Init"]},
                status="pending",
            )
            session.add(task)
            await session.flush()

            # Update multiple aspects of the task
            patch_data = {
                "task_description": "Patched description",
                "progresses": ["Init", "Processing"],
            }
            result = await update_task(
                session, task.id, status="running", order=5, patch_data=patch_data
            )

            data, error = result.unpack()
            assert error is None
            assert data is not None

            # Verify all updates were applied
            assert data.status == "running"
            assert data.order == 5
            assert data.data["task_description"] == "Patched description"
            assert data.data["progresses"] == ["Init", "Processing"]

            await session.delete(project)


class TestInsertTask:
    @pytest.mark.asyncio
    async def test_insert_task_success(self):
        """Test inserting a new task"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac8", secret_key_hash_phc="test_key_hash8"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            data = {"task_description": "A new task"}
            after_order = 0  # Insert after position 0 (will become position 1)

            result = await insert_task(
                session, project.id, test_session.id, after_order, data
            )

            t_data, error = result.unpack()
            assert error is None
            assert t_data is not None
            assert isinstance(t_data, Task)  # Should return Task object, not UUID
            assert t_data.order == 1  # Should be at position 1
            assert t_data.data == data

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_insert_task_with_custom_status(self):
        """Test inserting a task with custom status"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac9", secret_key_hash_phc="test_key_hash9"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            data = {"task_description": "Custom status task"}
            after_order = 1  # Insert after position 1 (will become position 2)
            custom_status = "running"

            result = await insert_task(
                session,
                project.id,
                test_session.id,
                after_order,
                data,
                status=custom_status,
            )

            t_data, error = result.unpack()
            assert error is None
            assert t_data is not None
            assert isinstance(t_data, Task)
            assert t_data.status == custom_status
            assert t_data.order == 2  # Should be at position 2
            assert t_data.data == data

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_insert_task_default_status(self):
        """Test inserting a task with default status"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac10", secret_key_hash_phc="test_key_hash10"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            data = {"task_description": "Default status task"}
            after_order = 2  # Insert after position 2 (will become position 3)

            result = await insert_task(
                session, project.id, test_session.id, after_order, data
            )

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert isinstance(data, Task)
            assert data.status == "pending"  # Should have default status
            assert data.order == 3  # Should be at position 3

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_insert_task_complex_data(self):
        """Test inserting a task with complex JSON data including progresses"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac11", secret_key_hash_phc="test_key_hash11"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            complex_data = {
                "task_description": "Complex task with multiple progresses",
                "progresses": ["Validate input", "Process data", "Generate output"],
            }

            result = await insert_task(
                session, project.id, test_session.id, 0, complex_data
            )

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert isinstance(data, Task)
            assert data.data == complex_data

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_insert_order_increment(self):
        """Test that inserting a task increments subsequent task orders"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_order",
                secret_key_hash_phc="test_key_hash_order",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create initial tasks with orders 1, 2, 3
            task1 = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Task 1"},
                status="pending",
            )
            task2 = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=2,
                data={"task_description": "Task 2"},
                status="pending",
            )
            task3 = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=3,
                data={"task_description": "Task 3"},
                status="pending",
            )
            session.add_all([task1, task2, task3])
            await session.flush()

            # Insert a new task after position 1 (should become position 2)
            new_data = {"task_description": "Inserted task"}
            result = await insert_task(
                session, project.id, test_session.id, 1, new_data
            )

            new_task, error = result.unpack()
            assert error is None
            assert new_task.order == 2

            # Fetch all tasks and verify the new ordering
            fetch_result = await fetch_current_tasks(session, test_session.id)
            all_tasks, _ = fetch_result.unpack()

            assert len(all_tasks) == 4

            # Verify the new order: task1(1), inserted_task(2), task2(3), task3(4)
            assert all_tasks[0].data.task_description == "Task 1"
            assert all_tasks[0].order == 1

            assert all_tasks[1].data.task_description == "Inserted task"
            assert all_tasks[1].order == 2

            assert all_tasks[2].data.task_description == "Task 2"
            assert all_tasks[2].order == 3  # Was 2, now 3

            assert all_tasks[3].data.task_description == "Task 3"
            assert all_tasks[3].order == 4  # Was 3, now 4

            await session.delete(project)


class TestDeleteTask:
    @pytest.mark.asyncio
    async def test_delete_task_success(self):
        """Test deleting an existing task"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac12", secret_key_hash_phc="test_key_hash12"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Task to delete"},
                status="pending",
            )
            session.add(task)
            await session.flush()

            task_id = task.id

            result = await delete_task(session, task_id)

            data, error = result.unpack()
            assert error is None
            assert data is None

            # Verify the task was actually deleted
            query = select(Task).where(Task.id == task_id)
            db_result = await session.execute(query)
            deleted_task = db_result.scalars().first()

            assert deleted_task is None

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_delete_nonexistent_task(self):
        """Test deleting a task that doesn't exist (should not raise error)"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            non_existent_task_id = uuid.uuid4()

            result = await delete_task(session, non_existent_task_id)

            data, error = result.unpack()
            assert error is None
            assert data is None

    @pytest.mark.asyncio
    async def test_delete_task_cascade_behavior(self):
        """Test that deleting a task doesn't affect other tasks"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac13", secret_key_hash_phc="test_key_hash13"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create multiple tasks
            task1 = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Task 1"},
                status="pending",
            )
            task2 = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=2,
                data={"task_description": "Task 2"},
                status="running",
            )
            task3 = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=3,
                data={"task_description": "Task 3"},
                status="success",
            )
            session.add_all([task1, task2, task3])
            await session.flush()

            initial_count = 3
            task_to_delete = task2  # Delete middle task

            result = await delete_task(session, task_to_delete.id)

            data, error = result.unpack()
            assert error is None

            # Verify other tasks still exist
            count_query = select(func.count(Task.id)).where(
                Task.session_id == task_to_delete.session_id
            )
            count_result = await session.execute(count_query)
            remaining_count = count_result.scalar()

            assert remaining_count == initial_count - 1

            await session.delete(project)


class TestIntegrationScenarios:
    @pytest.mark.asyncio
    async def test_full_task_lifecycle(self):
        """Test complete task lifecycle: create, update, fetch, delete"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac14", secret_key_hash_phc="test_key_hash14"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # 1. Create a task
            initial_data = {"task_description": "Lifecycle task created"}
            create_result = await insert_task(
                session, project.id, test_session.id, 0, initial_data
            )
            created_task, _ = create_result.unpack()
            assert created_task is not None
            task_id = created_task.id

            # 2. Update the task
            updated_data = {
                "task_description": "Lifecycle task updated",
                "progresses": ["Step 1"],
            }
            update_result = await update_task(
                session, task_id, data=updated_data, status="running"
            )
            updated_task, _ = update_result.unpack()
            assert updated_task.data == updated_data
            assert updated_task.status == "running"

            # 3. Fetch the task
            fetch_result = await fetch_current_tasks(session, test_session.id)
            tasks, _ = fetch_result.unpack()
            assert len(tasks) == 1
            assert tasks[0].id == task_id
            assert tasks[0].data.task_description == "Lifecycle task updated"

            # 4. Delete the task
            delete_result = await delete_task(session, task_id)
            _, error = delete_result.unpack()
            assert error is None

            # 5. Verify task is gone
            final_fetch_result = await fetch_current_tasks(session, test_session.id)
            final_tasks, _ = final_fetch_result.unpack()
            assert len(final_tasks) == 0

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_multiple_sessions_isolation(self):
        """Test that tasks from different sessions are properly isolated"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create two different sessions
            project = Project(
                secret_key_hmac="test_key_hmac15", secret_key_hash_phc="test_key_hash15"
            )
            session.add(project)
            await session.flush()

            space1 = Space(project_id=project.id)
            space2 = Space(project_id=project.id)
            session.add_all([space1, space2])
            await session.flush()

            session1 = Session(project_id=project.id, space_id=space1.id)
            session2 = Session(project_id=project.id, space_id=space2.id)
            session.add_all([session1, session2])
            await session.flush()

            # Create tasks in each session
            await insert_task(
                session,
                project.id,
                session1.id,
                0,
                {"task_description": "Session 1 Task A"},
            )
            await insert_task(
                session,
                project.id,
                session1.id,
                1,
                {"task_description": "Session 1 Task B"},
            )
            await insert_task(
                session,
                project.id,
                session2.id,
                0,
                {"task_description": "Session 2 Task A"},
            )

            # Fetch tasks for each session
            session1_tasks_result = await fetch_current_tasks(session, session1.id)
            session2_tasks_result = await fetch_current_tasks(session, session2.id)

            session1_tasks, _ = session1_tasks_result.unpack()
            session2_tasks, _ = session2_tasks_result.unpack()

            # Verify isolation
            assert len(session1_tasks) == 2
            assert len(session2_tasks) == 1
            assert all(task.session_id == session1.id for task in session1_tasks)
            assert all(task.session_id == session2.id for task in session2_tasks)

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_ordering_after_updates(self):
        """Test that task ordering is maintained after updates and insertions"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac16", secret_key_hash_phc="test_key_hash16"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create initial tasks in order
            task1_result = await insert_task(
                session,
                project.id,
                test_session.id,
                0,
                {"task_description": "Task 1"},  # Insert after 0 -> position 1
            )
            task2_result = await insert_task(
                session,
                project.id,
                test_session.id,
                1,
                {"task_description": "Task 2"},  # Insert after 1 -> position 2
            )
            task3_result = await insert_task(
                session,
                project.id,
                test_session.id,
                2,
                {"task_description": "Task 3"},  # Insert after 2 -> position 3
            )

            task1, _ = task1_result.unpack()
            task2, _ = task2_result.unpack()
            task3, _ = task3_result.unpack()

            # Insert a new task in the middle (after position 1)
            middle_task_result = await insert_task(
                session,
                project.id,
                test_session.id,
                1,
                {"task_description": "Middle task"},  # Insert after 1 -> position 2
            )
            middle_task, _ = middle_task_result.unpack()

            # Fetch and verify the new ordering
            fetch_result = await fetch_current_tasks(session, test_session.id)
            tasks, _ = fetch_result.unpack()

            assert len(tasks) == 4

            # Expected order: task1(1), middle_task(2), task2(3), task3(4)
            assert tasks[0].id == task1.id
            assert tasks[0].order == 1

            assert tasks[1].id == middle_task.id
            assert tasks[1].order == 2

            assert tasks[2].id == task2.id
            assert tasks[2].order == 3  # Was 2, incremented to 3

            assert tasks[3].id == task3.id
            assert tasks[3].order == 4  # Was 3, incremented to 4

            # Now test manual order updates
            await update_task(session, task1.id, order=10)  # Move task1 to the end

            # Fetch again and verify
            fetch_result2 = await fetch_current_tasks(session, test_session.id)
            tasks2, _ = fetch_result2.unpack()

            # Note: This doesn't automatically reorder other tasks - that would need
            # additional logic. For now, just verify the update worked.
            task1_updated = next(t for t in tasks2 if t.id == task1.id)
            assert task1_updated.order == 10

            await session.delete(project)


class TestAppendProgressToTask:
    @pytest.mark.asyncio
    async def test_append_progress_to_null_progresses(self):
        """Test appending progress when progresses field is NULL"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_progress1",
                secret_key_hash_phc="test_key_hash_progress1",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create task without progresses in data
            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test task"},  # No progresses field
                status="running",
            )
            session.add(task)
            await session.flush()

            # Append first progress
            progress_message = "Started processing data"
            result = await append_progress_to_task(session, task.id, progress_message)

            # Verify result
            data, error = result.unpack()
            assert error is None
            assert data is None  # Function returns None on success

            # Verify the progress was appended
            await session.refresh(task)
            assert "progresses" in task.data
            assert len(task.data["progresses"]) == 1
            assert task.data["progresses"][0] == progress_message

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_append_progress_to_existing_progresses(self):
        """Test appending progress to existing progresses array"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_progress2",
                secret_key_hash_phc="test_key_hash_progress2",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create task with initial progresses in data
            initial_progresses = ["Started task", "Loading data"]
            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={
                    "task_description": "Test task",
                    "progresses": initial_progresses.copy(),
                },
                status="running",
            )
            session.add(task)
            await session.flush()

            # Append new progress
            new_progress = "Processing data"
            result = await append_progress_to_task(session, task.id, new_progress)

            # Verify result
            data, error = result.unpack()
            assert error is None
            assert data is None

            # Verify the progress was appended
            await session.refresh(task)
            assert "progresses" in task.data
            assert len(task.data["progresses"]) == 3
            assert task.data["progresses"][0] == "Started task"
            assert task.data["progresses"][1] == "Loading data"
            assert task.data["progresses"][2] == "Processing data"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_append_multiple_progresses_sequentially(self):
        """Test appending multiple progresses in sequence"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_progress3",
                secret_key_hash_phc="test_key_hash_progress3",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create task without progresses
            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test task"},
                status="running",
            )
            session.add(task)
            await session.flush()

            # Append multiple progresses
            progress_messages = [
                "Task initialized",
                "Data loaded",
                "Processing started",
                "50% complete",
                "Processing finished",
            ]

            for progress in progress_messages:
                result = await append_progress_to_task(session, task.id, progress)
                data, error = result.unpack()
                assert error is None

            # Verify all progresses were appended in order
            await session.refresh(task)
            assert "progresses" in task.data
            assert len(task.data["progresses"]) == len(progress_messages)
            for i, progress in enumerate(progress_messages):
                assert task.data["progresses"][i] == progress

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_append_progress_with_empty_array(self):
        """Test appending progress to an empty array"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_progress4",
                secret_key_hash_phc="test_key_hash_progress4",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create task with empty progresses array in data
            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test task", "progresses": []},
                status="running",
            )
            session.add(task)
            await session.flush()

            # Append progress
            progress_message = "First progress after empty array"
            result = await append_progress_to_task(session, task.id, progress_message)

            # Verify result
            data, error = result.unpack()
            assert error is None

            # Verify the progress was appended
            await session.refresh(task)
            assert "progresses" in task.data
            assert len(task.data["progresses"]) == 1
            assert task.data["progresses"][0] == progress_message

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_append_progress_with_special_characters(self):
        """Test appending progress with special characters and Unicode"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_progress5",
                secret_key_hash_phc="test_key_hash_progress5",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test task"},
                status="running",
            )
            session.add(task)
            await session.flush()

            # Test with special characters
            special_progresses = [
                "Progress with 'quotes' and \"double quotes\"",
                "Progress with newline\ncharacter",
                "Progress with Unicode: 你好世界 🚀",
                "Progress with special chars: !@#$%^&*()",
            ]

            for progress in special_progresses:
                result = await append_progress_to_task(session, task.id, progress)
                data, error = result.unpack()
                assert error is None

            # Verify all progresses were appended correctly
            await session.refresh(task)
            assert "progresses" in task.data
            assert len(task.data["progresses"]) == len(special_progresses)
            for i, progress in enumerate(special_progresses):
                assert task.data["progresses"][i] == progress

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_append_progress_task_not_found(self):
        """Test appending progress to non-existent task"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Try to append progress to non-existent task
            fake_task_id = "00000000-0000-0000-0000-000000000000"
            result = await append_progress_to_task(
                session, fake_task_id, "Some progress"
            )

            # Verify error
            data, error = result.unpack()
            assert data is None
            assert error is not None
            assert "not found" in error.errmsg


class TestAppendSopThinkingToTask:
    @pytest.mark.asyncio
    async def test_append_sop_thinking_success(self):
        """Test appending sop_thinking to a task using JSONB update"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_sop_thinking1",
                secret_key_hash_phc="test_key_hash_sop_thinking1",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create task with initial data
            initial_data = {"task_description": "Test SOP task"}
            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data=initial_data,
                status="running",
            )
            session.add(task)
            await session.flush()

            # Append sop_thinking
            thinking_text = "This is my thinking about the task"
            result = await append_sop_thinking_to_task(session, task.id, thinking_text)

            # Verify result
            data, error = result.unpack()
            assert error is None
            assert data is None  # Function returns None on success

            # Verify the thinking was appended
            await session.refresh(task)
            assert "sop_thinking" in task.data
            assert task.data["sop_thinking"] == thinking_text
            # Verify original data is preserved
            assert task.data["task_description"] == "Test SOP task"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_append_sop_thinking_overwrites_existing(self):
        """Test that appending sop_thinking overwrites existing value"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_sop_thinking2",
                secret_key_hash_phc="test_key_hash_sop_thinking2",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create task with existing sop_thinking
            initial_data = {
                "task_description": "Test SOP task",
                "sop_thinking": "Old thinking",
            }
            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data=initial_data,
                status="running",
            )
            session.add(task)
            await session.flush()

            # Append new sop_thinking
            new_thinking = "New thinking that replaces old"
            result = await append_sop_thinking_to_task(session, task.id, new_thinking)

            # Verify result
            data, error = result.unpack()
            assert error is None

            # Verify the thinking was updated
            await session.refresh(task)
            assert task.data["sop_thinking"] == new_thinking
            assert task.data["sop_thinking"] != "Old thinking"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_append_sop_thinking_task_not_found(self):
        """Test appending sop_thinking to non-existent task"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Try to append thinking to non-existent task
            fake_task_id = uuid.uuid4()
            result = await append_sop_thinking_to_task(
                session, fake_task_id, "Some thinking"
            )

            # Verify error
            data, error = result.unpack()
            assert data is None
            assert error is not None
            assert "not found" in error.errmsg

    @pytest.mark.asyncio
    async def test_append_sop_thinking_preserves_other_fields(self):
        """Test that appending sop_thinking preserves other JSONB fields"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_sop_thinking3",
                secret_key_hash_phc="test_key_hash_sop_thinking3",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create task with complex data
            initial_data = {
                "task_description": "Complex task",
                "progresses": ["Step 1", "Step 2"],
                "metadata": {"key1": "value1", "key2": "value2"},
                "status_info": "In progress",
            }
            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data=initial_data.copy(),
                status="running",
            )
            session.add(task)
            await session.flush()

            # Append sop_thinking
            thinking_text = "Detailed thinking process"
            result = await append_sop_thinking_to_task(session, task.id, thinking_text)

            # Verify result
            data, error = result.unpack()
            assert error is None

            # Verify all fields are preserved and sop_thinking is added
            await session.refresh(task)
            assert task.data["sop_thinking"] == thinking_text
            assert task.data["task_description"] == initial_data["task_description"]
            assert task.data["progresses"] == initial_data["progresses"]
            assert task.data["metadata"] == initial_data["metadata"]
            assert task.data["status_info"] == initial_data["status_info"]

            await session.delete(project)
