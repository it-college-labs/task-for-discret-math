from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


RED = "red"
BLACK = "black"


@dataclass
class Node:
    id: str
    value: int
    color: str = RED
    left: Optional["Node"] = None
    right: Optional["Node"] = None
    parent: Optional["Node"] = None


class DuplicateValueError(ValueError):
    pass


class RBTree:
    def __init__(self) -> None:
        self.root: Optional[Node] = None
        self._next_id = 1

    def reset(self) -> None:
        self.root = None
        self._next_id = 1

    def insert(self, value: int) -> Dict[str, object]:
        parent: Optional[Node] = None
        current = self.root

        while current is not None:
            parent = current
            if value == current.value:
                raise DuplicateValueError(f"Value {value} already exists")
            if value < current.value:
                current = current.left
            else:
                current = current.right

        node = Node(id=f"n{self._next_id}", value=value)
        self._next_id += 1
        node.parent = parent

        if parent is None:
            self.root = node
        elif value < parent.value:
            parent.left = node
        else:
            parent.right = node

        steps: List[Dict[str, object]] = []
        self._record_step(
            steps,
            "insert_node",
            [node, parent],
            meta={
                "insertedValue": value,
                "parentNodeId": self._node_id(parent),
            },
        )
        self._fix_insert(node, steps, value)

        return {
            "tree": self.export(),
            "steps": steps,
            "insertedValue": value,
        }

    def export(self) -> Dict[str, object]:
        nodes: List[Dict[str, object]] = []

        def walk(node: Optional[Node]) -> None:
            if node is None:
                return
            walk(node.left)
            nodes.append(
                {
                    "id": node.id,
                    "value": node.value,
                    "color": node.color,
                    "left": self._node_id(node.left),
                    "right": self._node_id(node.right),
                    "parent": self._node_id(node.parent),
                }
            )
            walk(node.right)

        walk(self.root)
        return {
            "rootId": self._node_id(self.root),
            "nodes": nodes,
        }

    def validate(self) -> None:
        if self.root is None:
            return
        if self.root.color != BLACK:
            raise AssertionError("Root must be black")

        def dfs(node: Optional[Node]) -> int:
            if node is None:
                return 1
            if node.color not in {RED, BLACK}:
                raise AssertionError("Invalid color")
            if node.color == RED:
                if self._color(node.left) == RED or self._color(node.right) == RED:
                    raise AssertionError("Red node has red child")
            if node.left and node.left.value >= node.value:
                raise AssertionError("BST invariant violated on left child")
            if node.right and node.right.value <= node.value:
                raise AssertionError("BST invariant violated on right child")
            left_black_height = dfs(node.left)
            right_black_height = dfs(node.right)
            if left_black_height != right_black_height:
                raise AssertionError("Black heights do not match")
            return left_black_height + (1 if node.color == BLACK else 0)

        dfs(self.root)

    def _fix_insert(self, node: Node, steps: List[Dict[str, object]], inserted_value: int) -> None:
        while node != self.root and self._color(node.parent) == RED:
            parent = node.parent
            grandparent = parent.parent if parent else None
            if parent is None or grandparent is None:
                break

            if parent == grandparent.left:
                uncle = grandparent.right
                if self._color(uncle) == RED:
                    changes = self._apply_color_changes(
                        [
                            (parent, BLACK),
                            (uncle, BLACK),
                            (grandparent, RED),
                        ]
                    )
                    self._record_step(
                        steps,
                        "recolor",
                        [node, parent, uncle, grandparent],
                        color_changes=changes,
                        meta={
                            "insertedValue": inserted_value,
                            "parentNodeId": parent.id,
                            "uncleNodeId": self._node_id(uncle),
                            "grandparentNodeId": grandparent.id,
                        },
                    )
                    node = grandparent
                else:
                    if node == parent.right:
                        node = parent
                        self._rotate_left(node)
                        self._record_step(
                            steps,
                            "rotate_left",
                            [node, node.parent, grandparent],
                            meta={
                                "insertedValue": inserted_value,
                                "pivotNodeId": node.id,
                                "grandparentNodeId": self._node_id(grandparent),
                            },
                        )
                        parent = node.parent
                        grandparent = parent.parent if parent else None
                    if parent is None or grandparent is None:
                        continue
                    changes = self._apply_color_changes(
                        [
                            (parent, BLACK),
                            (grandparent, RED),
                        ]
                    )
                    self._record_step(
                        steps,
                        "recolor",
                        [node, parent, grandparent],
                        color_changes=changes,
                        meta={
                            "insertedValue": inserted_value,
                            "parentNodeId": parent.id,
                            "grandparentNodeId": grandparent.id,
                        },
                    )
                    self._rotate_right(grandparent)
                    self._record_step(
                        steps,
                        "rotate_right",
                        [parent, grandparent],
                        meta={
                            "insertedValue": inserted_value,
                            "pivotNodeId": grandparent.id,
                        },
                    )
            else:
                uncle = grandparent.left
                if self._color(uncle) == RED:
                    changes = self._apply_color_changes(
                        [
                            (parent, BLACK),
                            (uncle, BLACK),
                            (grandparent, RED),
                        ]
                    )
                    self._record_step(
                        steps,
                        "recolor",
                        [node, parent, uncle, grandparent],
                        color_changes=changes,
                        meta={
                            "insertedValue": inserted_value,
                            "parentNodeId": parent.id,
                            "uncleNodeId": self._node_id(uncle),
                            "grandparentNodeId": grandparent.id,
                        },
                    )
                    node = grandparent
                else:
                    if node == parent.left:
                        node = parent
                        self._rotate_right(node)
                        self._record_step(
                            steps,
                            "rotate_right",
                            [node, node.parent, grandparent],
                            meta={
                                "insertedValue": inserted_value,
                                "pivotNodeId": node.id,
                                "grandparentNodeId": self._node_id(grandparent),
                            },
                        )
                        parent = node.parent
                        grandparent = parent.parent if parent else None
                    if parent is None or grandparent is None:
                        continue
                    changes = self._apply_color_changes(
                        [
                            (parent, BLACK),
                            (grandparent, RED),
                        ]
                    )
                    self._record_step(
                        steps,
                        "recolor",
                        [node, parent, grandparent],
                        color_changes=changes,
                        meta={
                            "insertedValue": inserted_value,
                            "parentNodeId": parent.id,
                            "grandparentNodeId": grandparent.id,
                        },
                    )
                    self._rotate_left(grandparent)
                    self._record_step(
                        steps,
                        "rotate_left",
                        [parent, grandparent],
                        meta={
                            "insertedValue": inserted_value,
                            "pivotNodeId": grandparent.id,
                        },
                    )

        if self.root and self.root.color != BLACK:
            changes = self._apply_color_changes([(self.root, BLACK)])
            self._record_step(
                steps,
                "root_recolor",
                [self.root],
                color_changes=changes,
                meta={"insertedValue": inserted_value, "rootNodeId": self.root.id},
            )

    def _rotate_left(self, node: Node) -> None:
        pivot = node.right
        if pivot is None:
            return
        node.right = pivot.left
        if pivot.left is not None:
            pivot.left.parent = node
        pivot.parent = node.parent
        if node.parent is None:
            self.root = pivot
        elif node == node.parent.left:
            node.parent.left = pivot
        else:
            node.parent.right = pivot
        pivot.left = node
        node.parent = pivot

    def _rotate_right(self, node: Node) -> None:
        pivot = node.left
        if pivot is None:
            return
        node.left = pivot.right
        if pivot.right is not None:
            pivot.right.parent = node
        pivot.parent = node.parent
        if node.parent is None:
            self.root = pivot
        elif node == node.parent.right:
            node.parent.right = pivot
        else:
            node.parent.left = pivot
        pivot.right = node
        node.parent = pivot

    def _record_step(
        self,
        steps: List[Dict[str, object]],
        step_type: str,
        nodes: List[Optional[Node]],
        color_changes: Optional[List[Dict[str, str]]] = None,
        meta: Optional[Dict[str, object]] = None,
    ) -> None:
        ids = []
        for node in nodes:
            node_id = self._node_id(node)
            if node_id and node_id not in ids:
                ids.append(node_id)
        steps.append(
            {
                "type": step_type,
                "affectedNodeIds": ids,
                "colorChanges": color_changes or [],
                "snapshot": self.export(),
                "meta": meta or {},
            }
        )

    def _apply_color_changes(self, operations: List[tuple[Optional[Node], str]]) -> List[Dict[str, str]]:
        changes: List[Dict[str, str]] = []
        for node, new_color in operations:
            if node is None or node.color == new_color:
                continue
            changes.append(
                {
                    "nodeId": node.id,
                    "from": node.color,
                    "to": new_color,
                }
            )
            node.color = new_color
        return changes

    @staticmethod
    def _color(node: Optional[Node]) -> str:
        return node.color if node else BLACK

    @staticmethod
    def _node_id(node: Optional[Node]) -> Optional[str]:
        return node.id if node else None
