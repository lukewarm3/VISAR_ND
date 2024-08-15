import React, { useEffect } from "react";
import { mergeRegister } from "@lexical/utils";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useDispatch, useSelector } from "react-redux";
import {
  addDeletedNodeAndEdgeBackToChart,
  addDeletedNodeAndEdgeToHistory,
  setEdges,
  setNodes,
} from "../slices/FlowSlice";

const ReactFlowHistoryPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const dispatch = useDispatch();
  const deletedNodeHistory = useSelector(
    (state) => state.flow.deletedNodeHistory
  );
  const nodeMapping = useSelector((state) => state.flow.flowEditorNodeMapping);
  const nodes = useSelector((state) => state.flow.nodes);
  const edges = useSelector((state) => state.flow.edges);

  const checkDeletedNodeHistory = () => {
    console.log(
      "[react flow history] deleteNodeHistory is ",
      deletedNodeHistory
    );
    const editorState = editor.getEditorState();

    // check if the editor has the node that does not have a corresponding flow node in the chart
    editorState._nodeMap.forEach((_, key) => {
      let flowNodeKey = null;
      for (const [flowKey, editorKey] of Object.entries(nodeMapping)) {
        if (editorKey === key) {
          flowNodeKey = flowKey;
          break;
        }
      }

      if (flowNodeKey in deletedNodeHistory) {
        console.log(
          "[react flow history] undo/redo, then find the deleted node key in history: ",
          flowNodeKey
        );
        dispatch(addDeletedNodeAndEdgeBackToChart(flowNodeKey));
      }
    });

    console.log(
      "[react flow history] nodes and nodeMapping",
      nodes,
      nodeMapping
    );
    console.log(
      "[react flow history] editorState.nodeMap is ",
      editorState._nodeMap
    );

    let updatedNodes = [...nodes];
    let updatedEdges = [...edges];
    let updated = false;
    for (const node of nodes) {
      const nodeId = node.id;

      // check if there is an existing editor key that matches the flow node
      if (nodeId in nodeMapping) {
        const editorKey = nodeMapping[nodeId];

        // check if the editor does not have the node that corresponds to the flow node in the chart
        if (!editorState._nodeMap.has(editorKey)) {
          // delete the react flow node
          updated = true;
          const deletedNode = nodes.filter((node) => node.id === nodeId);
          const deletedEdges = edges.filter((edge) => edge.target === nodeId);
          updatedNodes = updatedNodes.filter((node) => node.id !== nodeId);
          updatedEdges = updatedEdges.filter((edge) => edge.target !== nodeId);
          console.log("[react flow history] deleted nodes are ", deletedNode);
          dispatch(
            addDeletedNodeAndEdgeToHistory({
              deletedNodeID: nodeId,
              deletedNode,
              deletedEdges,
            })
          );
        }
      }
    }

    if (updated) {
      dispatch(setNodes({ updatedNodes }));
      dispatch(setEdges({ updatedEdges }));
    }
  };

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          checkDeletedNodeHistory();
        });
      })
    );
  }, [editor, deletedNodeHistory, nodeMapping, nodes, edges]);
  return null;
};

export default ReactFlowHistoryPlugin;
