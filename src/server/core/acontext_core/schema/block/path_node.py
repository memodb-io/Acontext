from pydantic import BaseModel, Field
from ..utils import asUUID
from ..orm.block import BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE


class PathNode(BaseModel):
    id: asUUID
    title: str
    type: str
    props: dict = Field(default_factory=dict)
    sub_page_num: int = 0
    sub_folder_num: int = 0


def repr_path_tree(path_nodes: dict[str, PathNode]) -> str:
    ordered_path = sorted(path_nodes.items(), key=lambda x: x[0])
    remove_not_end_paths: list[tuple[str, PathNode]] = []
    for dp in ordered_path:
        if not len(remove_not_end_paths):
            remove_not_end_paths.append(dp)
            continue
        prefix_p = remove_not_end_paths[-1]
        if prefix_p[0] in dp[0] and prefix_p[1].type == BLOCK_TYPE_FOLDER:
            remove_not_end_paths.pop()
        remove_not_end_paths.append(dp)

    _repr_tree = "\n".join(
        (
            f"{dp[0]} (page)"
            if dp[1].type == BLOCK_TYPE_PAGE
            else f"{dp[0]} (folder, has {dp[1].sub_page_num} pages & {dp[1].sub_folder_num} folders)"
        )
        for dp in remove_not_end_paths
    )
    return _repr_tree
