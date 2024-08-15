import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import Modal from "@mui/material/Modal";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  useViewport,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { useDispatch, useSelector } from "react-redux";
import {
  setFlowModalOpen,
  setFlowModalClose,
  setCurSelectedNodeKey,
  setCurClickedNodeKey,
  setRangeGenerationMode,
} from "../slices/EditorSlice";
import { SHOW_LOADING_COMMAND } from "../commands/SelfDefinedCommands";
import { cyan, teal, pink, amber } from "@mui/material/colors";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import {
  onNodesChange,
  onEdgesChange,
  onConnect,
  loadNodes,
  addUserDefinedFlowNode,
  generateFromSketch,
  extendFlowEditorNodeMapping,
  generateFromDepGraph,
  extendDepGraph,
  removeNodeFromDepGraph,
  setFlowEditorNodeMapping,
  setIsLazyUpdate,
  addDeletedNodeAndEdgeToHistory,
} from "../slices/FlowSlice";
import {
  Box,
  Typography,
  Button,
  Grid,
  Stack,
  Avatar,
  IconButton,
  Tooltip,
  Divider,
  Switch,
  FormGroup,
  FormControlLabel,
} from "@mui/material";
import ResizableNode from "../../ReactFlow/nodes/ResizableNode";
import CustomGroupNode from "../../ReactFlow/nodes/CustomGroupNode";
import CustomEdge from "../../ReactFlow/edges/CustomEdge";
import { autoBatchEnhancer } from "@reduxjs/toolkit";
import { addGenerationsFromSketch, addGenartionsToEditor } from "../utils";
import { $getNodeByKey, $createTextNode, $createLineBreakNode } from "lexical";
import AddBoxIcon from "@mui/icons-material/AddBox";
import AddIcon from "@mui/icons-material/Add";
import LoopIcon from "@mui/icons-material/Loop";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import { removeNode } from "../utils";
import {
  $createHighlightDepNode,
  $isHighlightDepNode,
} from "../nodes/HighlightDepNode";
import { $createTextBlockNode } from "../nodes/TextBlockNode";
import { setCurrentStep } from "../slices/IntroSlice";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "80vw",
  height: "90vh",
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  pt: 2,
  px: 4,
  pb: 3,
};

const updateStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "80vw",
  height: "90vh",
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  pt: 2,
  px: 4,
  pb: 3,
};

const pluginStyle = {
  position: "absolute",
  cursor: "default",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "100%",
  height: "100%",
  bgcolor: "background.paper",
};

const nodeTypes = {
  customNode: ResizableNode,
  CustomGroupNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

export default function Flow({ editor, mode, sidebar }) {
  const dispatch = useDispatch();
  const nodes = useSelector((state) => state.flow.nodes);
  const edges = useSelector((state) => state.flow.edges);
  const avatarColors = useSelector((state) => state.flow.avatarColors);
  const selectedPrompts = useSelector((state) => state.editor.selectedPrompts);
  const backendResponse = useSelector((state) => state.flow.backendResponse);
  const isRangeMode = useSelector((state) => state.editor.isRangeMode);
  const curRangeNodeKey = useSelector((state) => state.editor.curRangeNodeKey);
  const curSelectedNodeKey = useSelector(
    (state) => state.editor.curSelectedNodeKey
  );
  const curSelection = useSelector((state) => state.editor.curSelection);
  const curClickedNodeKey = useSelector(
    (state) => state.editor.curClickedNodeKey
  );
  // const curRangeNodeKey = useSelector(state => state.editor.curRangeNodeKey)
  const dataFetched = useSelector((state) => state.flow.dataFetched);
  const nodeMappings = useSelector((state) => state.flow.flowEditorNodeMapping);
  const depGraph = useSelector((state) => state.flow.dependencyGraph);
  const [switchChecked, setSwitchChecked] = useState(false);
  const viewport = useViewport();

  const flowInstance = useReactFlow();

  const mindmapOpen = useSelector((state) => state.editor.mindmapOpen);
  const firstTimeUser = useSelector((state) => state.intro.firstTimeUser);
  const introInstance = useSelector((state) => state.intro.introInstance);
  const steps = useSelector((state) => state.intro.steps);
  const currentStep = useSelector((state) => state.intro.currentStep);

  const nodeColor = (node) => {
    switch (node.type) {
      case "input":
        return "#6ede87";
      case "output":
        return "#6865A5";
      default:
        return "#ff0072";
    }
  };

  useEffect(() => {
    if (firstTimeUser && introInstance && currentStep === 2 && mindmapOpen) {
      setTimeout(() => {
        dispatch(setCurrentStep(3));
        introInstance.setOptions({
          disableInteraction: true,
          steps: steps.slice(14, 17),
        });

        introInstance.start();
      }, 1000);
    }
  }, [currentStep, firstTimeUser, introInstance, steps, mindmapOpen]);

  const handleLazyUpdateChange = () => {
    setSwitchChecked(!switchChecked);
    dispatch(setIsLazyUpdate(!switchChecked));
  };

  const onGenerationClick = useCallback(() => {
    editor.update(() => {
      editor.dispatchCommand(SHOW_LOADING_COMMAND, { show: true });
    });
    dispatch(generateFromDepGraph()).then((action) => {
      const { depGraph, rootFlowKeys, nodeMappings } = action.payload;
      editor.update(() => {
        console.log("[onGenerationClick] depGraph:", depGraph);
        // before this, the text is not updated in the editor
        // this means the text node should be created and the flowEditorNodeMapping should be updated
        const { updatedMappings, updatedGraph } = addGenartionsToEditor(
          depGraph,
          rootFlowKeys,
          nodeMappings,
          curRangeNodeKey,
          isRangeMode
        ); // use DFS to add generation text to the text node
        editor.dispatchCommand(SHOW_LOADING_COMMAND, { show: false });
        dispatch(extendFlowEditorNodeMapping(updatedMappings));
        dispatch(extendDepGraph(updatedGraph));

        if (firstTimeUser && introInstance) {
          if (currentStep === 0) {
            dispatch(setCurrentStep(1));
            introInstance.setOptions({
              disableInteraction: true,
              steps: steps.slice(10, 11),
            });

            introInstance.start();
          } else if (currentStep === 1) {
            dispatch(setCurrentStep(2));
            introInstance.setOptions({
              disableInteraction: true,
              steps: steps.slice(12, 14),
            });

            introInstance.start();
          }
        }

        // const index = node.getTextContent().indexOf(curSelection)
        // if (index !== -1) {
        //   if (index > 0) {
        //     const preText = node.getTextContent().slice(0, index)
        //     const preTextNode = $createTextNode(preText)
        //     textblockNode.append(preTextNode)
        //     // node.replace(preTextNode)
        //     const hlNode = $createHighlightDepNode(
        //       'highlight-dep-elb',
        //       curSelection
        //     )
        //     hlNode.setStyle('background-color: #bde0fe')
        //     // preTextNode.insertAfter(hlNode)
        //     textblockNode.append(hlNode)
        //     lastNode = hlNode
        //     if (index + curSelection.length < node.getTextContent().length) {
        //       const postText = node
        //         .getTextContent()
        //         .slice(index + curSelection.length)
        //       const postTextNode = $createTextNode(postText)
        //       // hlNode.insertAfter(postTextNode)
        //       textblockNode.append(postTextNode)
        //       lastNode = postTextNode
        //     }
        //     node.replace(textblockNode)
        //   } else {
        //     const hlNode = $createHighlightDepNode(
        //       'highlight-dep-elb',
        //       curSelection
        //     )
        //     hlNode.setStyle('background-color: #bde0fe')
        //     textblockNode.append(hlNode)
        //     node.replace(textblockNode)
        //     lastNode = hlNode
        //     if (index + curSelection.length < node.getTextContent().length) {
        //       const postText = node
        //         .getTextContent()
        //         .slice(index + curSelection.length)
        //       const postTextNode = $createTextNode(postText)
        //       // node.insertAfter(postTextNode)
        //       textblockNode.append(postTextNode)
        //       lastNode = postTextNode
        //     }
        //     const spaceNode = $createTextNode('  ')
        //     // lastNode.insertAfter(spaceNode)
        //     textblockNode.append(spaceNode)
        //     const lineBreakNode1 = $createLineBreakNode()
        //     const lineBreakNode2 = $createLineBreakNode()
        //     textblockNode.append(lineBreakNode1)
        //     textblockNode.append(lineBreakNode2)
        //     // update the node mapping with the new hl node
        //     let oldFlowKey = null
        //     for (const [key, value] of Object.entries(nodeMappings)) {
        //       if (value === curRangeNodeKey) {
        //         oldFlowKey = key
        //         break
        //       }
        //     }
        //     if (oldFlowKey !== null) {
        //       dispatch(
        //         setFlowEditorNodeMapping({
        //           flowKey: oldFlowKey,
        //           EditorKey: hlNode.__key
        //         })
        //       )
        //     }
        //   }
        // else {
        //   console.log("cannot find the selection in the node's text content")
        // }
      });
    });
    dispatch(setRangeGenerationMode(false));
    dispatch(setFlowModalClose());
  }, []);

  const onNodeChange = (changes) => {
    changes.forEach((change) => {
      if (change.type === "remove") {
        const deletedNode = nodes.filter((node) => node.id === change.id);
        const deletedEdges = edges.filter((edge) => edge.target === change.id);
        dispatch(
          addDeletedNodeAndEdgeToHistory({
            deletedNodeID: change.id,
            deletedNode,
            deletedEdges,
          })
        );
      }
    });
    editor.update(() => {
      changes.forEach((change) => {
        if (change.type === "remove") {
          const editorNodeKey = nodeMappings[change.id];
          const nodeToRemove = $getNodeByKey(editorNodeKey); // the editor text node
          console.log("[flow] node to remove is ", nodeToRemove);
          if (nodeToRemove !== null && nodeToRemove !== undefined) {
            removeNode(nodeToRemove);
          }

          depGraph[change.id]["children"].forEach((child) => {
            const childEditorKey = nodeMappings[child];
            const childTextNode = $getNodeByKey(childEditorKey);
            if (childTextNode !== null && childTextNode !== undefined) {
              removeNode(childTextNode);
            }
          });

          //dispatch(removeNodeFromDepGraph(change.id));
        }
      });

      dispatch(onNodesChange(changes));
    });
  };

  const onAddNode = () => {
    console.log("flowInstance viewport:", flowInstance.getViewport());

    dispatch(
      addUserDefinedFlowNode({
        editorNodeKey: null,
        selectedText: "New Node",
        prompt: "New Node",
      })
    );
  };

  useEffect(() => {
    console.log("[Flow]: node focus changed");

    let flowNodeKey = null;
    for (const [key, value] of Object.entries(nodeMappings)) {
      if (value === curClickedNodeKey) {
        flowNodeKey = key;
      }
    }

    if (flowNodeKey === null) {
      return;
    }

    console.log("[Flow]: flow node key:", flowNodeKey);

    if (flowNodeKey !== null) {
      const node = flowInstance.getNode(flowNodeKey);
      // position is relative to the parent
      let parent = null;
      if (node.parentNode !== null) {
        parent = flowInstance.getNode(node.parentNode);
      }
      let x = node.position.x;
      let y = node.position.y;

      while (parent !== null && parent !== undefined) {
        x += parent.position.x;
        y += parent.position.y;
        parent = flowInstance.getNode(parent.parentNode);
      }

      const newViewPoint = { x: -x + 250, y: -y + 500, zoom: 1 };
      console.log("newViewPoint:", newViewPoint);
      // setViewport is used to move the canvas, NOT the camera
      flowInstance.setViewport(newViewPoint, { duration: 800 });
    }
  }, [curClickedNodeKey]);

  return (
    <Box>
      (
      <Grid
        container
        sx={
          mode === "modal"
            ? modalStyle
            : mode === "plugin"
            ? pluginStyle
            : updateStyle
        }
        spacing={2}
      >
        <Grid item xs={mode === "modal" ? 11 : 12}>
          <ReactFlow
            id="react-flow-plugin"
            nodes={nodes}
            onNodesChange={onNodeChange}
            edges={edges}
            onEdgesChange={(change) => dispatch(onEdgesChange(change))}
            onConnect={(change) => dispatch(onConnect(change))}
            nodeTypes={nodeTypes}
            elementsSelectable={true}
            edgeTypes={edgeTypes}
            fitView
          >
            <Background variant="dots" gap={12} size={1} />
            {/* <Controls /> */}
            <Panel id="add-node-panel" position="bottom-left">
              <Stack>
                <Tooltip title="Add node">
                  <IconButton onClick={onAddNode}>
                    <AddIcon />
                  </IconButton>
                </Tooltip>
                {switchChecked && (
                  <Box>
                    <Divider />
                    <Tooltip title="Generate text">
                      <IconButton onClick={onGenerationClick}>
                        <DriveFileRenameOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Stack>
            </Panel>
            {sidebar === false && (
              <Panel position="top-right">
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={switchChecked}
                        onChange={handleLazyUpdateChange}
                      />
                    }
                    label={
                      <Typography variant="body" sx={{ fontSize: 15 }}>
                        Lazy update
                      </Typography>
                    }
                  />
                </FormGroup>
              </Panel>
            )}

            <Panel position="top-left">
              <Stack
                direction="row"
                spacing={2}
                style={{ alignItems: "center", marginBottom: 4 }}
              >
                <Avatar
                  sx={{ bgcolor: avatarColors["A"] }}
                  style={{ width: 20, height: 20, fontSize: 10 }}
                >
                  A
                </Avatar>
                <Typography variant="body1" style={{ mt: 5, fontSize: 12 }}>
                  Main argument
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                style={{ alignItems: "center", marginBottom: 4 }}
              >
                <Avatar
                  sx={{ bgcolor: avatarColors["K"] }}
                  style={{ width: 20, height: 20, fontSize: 10 }}
                >
                  K
                </Avatar>
                <Typography variant="body1" style={{ mt: 5, fontSize: 12 }}>
                  Key point
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                style={{ alignItems: "center", marginBottom: 4 }}
              >
                <Avatar
                  sx={{ bgcolor: avatarColors["S"] }}
                  style={{ width: 20, height: 20, fontSize: 10 }}
                >
                  S
                </Avatar>
                <Typography variant="body1" style={{ mt: 5, fontSize: 12 }}>
                  Supporting evidence
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                style={{ alignItems: "center", marginBottom: 4 }}
              >
                <Avatar
                  sx={{ bgcolor: avatarColors["DP"] }}
                  style={{ width: 20, height: 20, fontSize: 10 }}
                >
                  DP
                </Avatar>
                <Typography variant="body1" style={{ mt: 5, fontSize: 12 }}>
                  Discussion point
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                style={{ alignItems: "center", marginBottom: 4 }}
              >
                <Avatar
                  sx={{ bgcolor: avatarColors["CA"] }}
                  style={{ width: 20, height: 20, fontSize: 10 }}
                >
                  CA
                </Avatar>
                <Typography variant="body1" style={{ mt: 5, fontSize: 12 }}>
                  Counter argument
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                style={{ alignItems: "center", marginBottom: 4 }}
              >
                <HourglassBottomIcon
                  style={{ width: 20, height: 20, fontSize: 10 }}
                />
                <Typography variant="body1" style={{ mt: 5, fontSize: 12 }}>
                  Wait for generating draft
                </Typography>
              </Stack>
              {/* <Stack
                direction='row'
                spacing={2}
                style={{ alignItems: 'center', marginBottom: 4 }}
              >
                <LoopIcon style={{ width: 20, height: 20, fontSize: 10 }} />
                <Typography variant='body1' style={{ mt: 5, fontSize: 12 }}>
                  Wait for updating draft
                </Typography>
              </Stack> */}
              <Stack
                direction="row"
                spacing={2}
                style={{ alignItems: "center", marginBottom: 4 }}
              >
                <CheckCircleOutlineIcon
                  style={{ width: 20, height: 20, fontSize: 10 }}
                />
                <Typography variant="body1" style={{ mt: 5, fontSize: 12 }}>
                  Draft done
                </Typography>
              </Stack>
            </Panel>
            <MiniMap
              nodeColor={nodeColor}
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
          </ReactFlow>
        </Grid>
        {sidebar === true && (
          <Grid item xs={1}>
            <Stack spacing={2}>
              <Box sx={{ display: "block" }}>
                <Button
                  id="generate-button"
                  sx={{ display: "inline-block" }}
                  variant="contained"
                  onClick={() => onGenerationClick()}
                >
                  Generate
                </Button>
              </Box>
              {/* <Button variant='contained' onClick={onAddNode}>
                Add
              </Button> */}
            </Stack>
          </Grid>
        )}
      </Grid>
      )
    </Box>
  );
}
