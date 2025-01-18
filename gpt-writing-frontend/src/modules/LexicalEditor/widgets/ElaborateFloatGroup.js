import {
  useCallback,
  useEffect,
  forwardRef,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SELECTION_CHANGE_COMMAND,
  $getSelection,
  $isRangeSelection,
  $getNodeByKey,
  $isParagraphNode,
  $createTextNode,
} from "lexical";
import {
  ELABORATE_COMMAND,
  EVIDENCE_COMMAND,
  lowPriority,
  highPriority,
} from "../commands/SelfDefinedCommands";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Skeleton from "@mui/material/Skeleton";
import CircularProgress from "@mui/material/CircularProgress";
import Select from "@mui/material/Select";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import {
  Button,
  Grid,
  MenuItem,
  Pagination,
  Tabs,
  Tab,
  Tooltip,
  Typography,
} from "@mui/material";
import { addDependency, getDependencies } from "../neo4j";
import { positionFloatingButton } from "../utils";
import { SHOW_LOADING_COMMAND } from "../commands/SelfDefinedCommands";
import { Container } from "@mui/system";
import { useSelector, useDispatch } from "react-redux";
import {
  setFlowModalOpen,
  toggleElabPromptKeywords,
  setPromptKeywords,
  handleSelectedPromptsChanged,
  initPrompts,
  setPrompts,
  setPromptStatus,
  setCurRangeNodeKey,
  setType,
  setCurSelectedNodeKey,
  setIsReactFlowInModal,
  setRangeGenerationMode,
} from "../slices/EditorSlice";
import { loadNodes, setNodeSelected } from "../slices/FlowSlice";

const Alert = forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ElaborateFLoatingGroup({ editor }) {
  const buttonRef = useRef(null);
  const selectedPrompts = useSelector((state) => state.editor.selectedPrompts);
  const curRangeNodeKey = useSelector((state) => state.editor.curRangeNodeKey);
  const selectedKeywords = useSelector(
    (state) => state.editor.selectedKeywords
  );
  const allKeywords = useSelector((state) => state.editor.allKeywords);
  const promptStatus = useSelector((state) => state.editor.promptStatus);
  const prompts = useSelector((state) => state.editor.prompts);
  const firstTimeUser = useSelector((state) => state.intro.firstTimeUser);
  const introInstance = useSelector((state) => state.intro.introInstance);
  const steps = useSelector((state) => state.intro.steps);
  const [isElaborate, setElaborate] = useState(false);
  const [isFetchingKeyword, setFetchingKeyword] = useState(false);
  const [promptedText, setPromptedText] = useState("");
  const [fetchingAlertOpen, setFetchingAlertOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const itemPerPage = 5;
  const type = useSelector((state) => state.editor.type);
  const [page, setPage] = useState(1);

  const [showSteps2, setShowSteps2] = useState(false);
  const [showSteps3, setShowSteps3] = useState(false);

  const dispatch = useDispatch();

  const handleChange = (event) => {
    setPromptedText(event.target.value);
  };

  useEffect(() => {
    if (firstTimeUser && introInstance) {
      if (showSteps2) {
        introInstance.setOptions({ disableInteraction: true, steps: steps.slice(6, 7) });

        introInstance.start();
        setShowSteps2(false);
      } else if (showSteps3) {
        introInstance.setOptions({ disableInteraction: true, steps: steps.slice(7, 8) });

        introInstance.start();
        setShowSteps3(false);
      }
    }
  }, [showSteps2, showSteps3]);

  // useCallback memorizes the state and will update when one of the dependency get updated
  const updateFloatingGroup = useCallback(() => {
    const selection = $getSelection();
    const buttonElem = buttonRef.current;
    const nativeSelection = window.getSelection();

    if (buttonElem === null) {
      return;
    }

    let condition;
    const rootElement = editor.getRootElement();
    const domRange =
      nativeSelection.rangeCount > 0 ? nativeSelection.getRangeAt(0) : null;

    if (type === "elaborate") {
      condition =
        selection != null &&
        !nativeSelection.isCollapsed &&
        rootElement != null &&
        rootElement.contains(nativeSelection.anchorNode) &&
        isElaborate;
    } else if (type === "evidence") {
      condition =
        selection != null &&
        rootElement != null &&
        rootElement.contains(nativeSelection.anchorNode) &&
        isElaborate;
    }

    if (condition && domRange) {
      let rect;
      if (nativeSelection.anchorNode === rootElement) {
        let inner = rootElement;
        while (inner.firstElementChild != null) {
          inner = inner.firstElementChild;
        }
        rect = inner.getBoundingClientReact();
      } else {
        rect = domRange.getBoundingClientRect();
      }

      positionFloatingButton(buttonElem, rect);
    } else {
      // console.log(`[updateFloatingGroup]: element is inactive, isElaborate: ${isElaborate}`)
      positionFloatingButton(buttonElem, null);
    }

    return true;
  }, [editor, isElaborate, type]);

  // fetch the strategic Keywordensions for elaborating the selected text
  const fetchKeyword = useCallback(() => {
    const selection = $getSelection();
    const selected_text = selection.getTextContent();
    const nodes = selection.getNodes();
    const node = nodes[0];
    // console.log("Nodes:")
    // console.log(nodes)
    setPromptedText(selected_text);
    console.log("[elaborate float group] selected text is", selected_text);

    const fetchPromise = fetch("http://127.0.0.1:5000/keyword", {
      method: "POST",
      mode: "cors",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        prompt: selected_text,
      }),
    });

    fetchPromise
      .then((res) => {
        return res.json();
      })
      .then((res) => {
        console.log("Test, the response is", res["response"]);
        let Keywords = res["response"];
        dispatch(setPromptKeywords(Keywords));
        setFetchingKeyword(false);
        setShowSteps2(true);
      })
      .catch((error) => {
        console.log("error is ", error);
      });
  }, [dispatch]);

  const fetchDiscussionPoints = () => {
    dispatch(setPromptStatus("fetching"));
    setFetchingAlertOpen(true);

    // IP: https://visar.app:8088
    fetch("http://127.0.0.1:5000/prompts", {
      method: "POST",
      mode: "cors",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        keywords: selectedKeywords,
        context: promptedText,
      }),
    })
      .then((response) => response.json())
      .then((response) => {
        dispatch(setPrompts(response["response"])); // prompts is an array of {key: key, prompt: prompt (discussion point)}
        dispatch(setPromptStatus("fetched"));
        setPage(1);
        setShowSteps3(true);
        // each keyword can have multiple prompts
        // if there are more than 6 prompts, there will be more than 1 page
      });
  };

  const elaborateByGPT = useCallback(() => {
    const selection = $getSelection();
    
    if (!selection) {
      console.warn('No selection found');
      return;
    }
    
    const selected_text = selection.getTextContent();
    if (!selected_text) {
      console.warn('No text content in selection');
      return;
    }

    if ($isRangeSelection(selection)) {
      console.log(`selection: ${selected_text}`);

      const fetchPromise = fetch(
        "http://http://localhost:5000/api/?" +
          new URLSearchParams({
            prompt: selected_text,
            mode: "elaborate",
          }),
        {
          mode: "no-cors",
        }
      );

      fetchPromise
        .then((res) => {
          return res.json();
        })
        .then((res) => {
          let text = res["response"].trim();

          editor.update(() => {
            text = text.replace(/\\n/g, " ");
            text = " " + text;

            const newTextNode = $createTextNode(text);

            const curTextNode = selection.getNodes()[0];
            if (!curTextNode) {
              console.warn('No current text node found');
              return;
            }

            const parent_key = curTextNode.getParentKeys()[0];
            const parent = $getNodeByKey(parent_key);
            
            if ($isParagraphNode(parent)) {
              parent.append(newTextNode);
              addDependency(curTextNode, newTextNode, "elaboratedBy");
            }
          });

          editor.dispatchCommand(SHOW_LOADING_COMMAND, { show: false });
        })
        .catch(error => {
          console.error('Error in elaborateByGPT:', error);
          editor.dispatchCommand(SHOW_LOADING_COMMAND, { show: false });
        });
    } else {
      console.log("It is not range selection");
    }
  }, [editor]);

  // this is used to tell the editor to show the floating button
  useEffect(() => {
    // console.log(`isElaborate changed: ${isElaborate}`)
    editor.getEditorState().read(() => {
      updateFloatingGroup();
    });
  }, [editor, isElaborate, updateFloatingGroup]);

  useEffect(() => {
    // const buttonElem = buttonRef.current;
    // const nativeSelection = window.getSelection();
    // const rootElement = editor.getRootElement();

    return mergeRegister(
      editor.registerCommand(
        ELABORATE_COMMAND,
        () => {
          // console.log(`ELABORATE_COMMAND listener is called`);
          dispatch(initPrompts());
          dispatch(setType("elaborate"));
          setFetchingKeyword(true);
          setElaborate(true);
          fetchKeyword();
          // console.log(`isElaborate: ${isElaborate}`)
          // updateFloatingGroup();
          return true;
        },
        lowPriority
      ),

      editor.registerCommand(
        EVIDENCE_COMMAND,
        () => {
          console.log(`EVIDENCE_COMMAND listener is called`);
          dispatch(initPrompts());
          dispatch(setType("evidence"));
          setFetchingKeyword(true);
          setElaborate(true);
          fetchKeyword();
          // console.log(`isElaborate: ${isElaborate}`)
          // updateFloatingGroup();
          return true;
        },
        lowPriority
      ),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = $getSelection();
          setElaborate(false);
          
          if (!selection) {
            console.warn('[SELECTION_CHANGE_COMMAND] No selection found');
            return false;
          }

          const nodes = selection.getNodes();
          if (!nodes || nodes.length === 0) {
            console.warn('[SELECTION_CHANGE_COMMAND] No nodes in selection');
            return false;
          }

          setPromptedText(selection.getTextContent());
          const selectedNodeKey = nodes[0].__key;
          if (selectedNodeKey) {
            dispatch(setCurRangeNodeKey(selectedNodeKey));
            dispatch(setNodeSelected(selectedNodeKey));
          }
          
          return false;
        },
        highPriority
      )
    );
  }, [editor, dispatch, fetchKeyword]);

  const onCLickElaboratePredict = () => {
    editor.update(() => {
      editor.dispatchCommand(SHOW_LOADING_COMMAND, { show: true });
      setElaborate(false);
      elaborateByGPT();
    });
  };

  const handleChipClick = (r) => {
    dispatch(toggleElabPromptKeywords(r));
    if (page > Math.ceil(prompts.length / itemPerPage)) {
      setPage(Math.max(Math.ceil(prompts.length / itemPerPage) - 1, 0));
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleTabChange = (event, value) => {
    setTabValue(value);
    setPage(1);
  };

  const handleAlertClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setFetchingAlertOpen(false);
  };

  // const handleChipDelete = (r) => {
  //   console.log(r);
  //   dispatch(toggleElabPromptKeywords(r));
  //   if (page > Math.ceil(prompts.length / itemPerPage)) {
  //     setPage(Math.max(Math.ceil(prompts.length / itemPerPage) - 1, 0));
  //   }
  // };

  const handleContentSketchingClicked = (e) => {
    // Validate data before dispatch
    if (!promptedText || !selectedKeywords || !selectedPrompts) {
      console.error('Missing required data for content sketching');
      return;
    }

    dispatch(
      loadNodes({
        selectedText: promptedText || '',
        selectedKeywords: selectedKeywords || [],
        discussionPoints: selectedPrompts || [],
        curRangeNodeKey: curRangeNodeKey,
      })
    );
    
    dispatch(setFlowModalOpen());
    dispatch(setRangeGenerationMode(true));
    positionFloatingButton(buttonRef.current, null);
    dispatch(setPromptStatus("empty"));
    dispatch(setIsReactFlowInModal());
  };

  const disableSketch = useCallback(() => {
    const selectKeywordDiscussionPointNumber = selectedKeywords.reduce(
      (acc, cur) => {
        acc[cur] = 0;
        return acc
      },
      {}
    );

    selectedPrompts.forEach((p) => {
      selectKeywordDiscussionPointNumber[p["keyword"]] += 1;
    });

    return Object.values(selectKeywordDiscussionPointNumber).some(
      (v) => v === 0
    );
  }, [selectedKeywords, selectedPrompts]);

  return (
    <div ref={buttonRef} className="elaborate-group">
      {isFetchingKeyword ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography sx={{ mr: 4 }}>Looking for keywords...</Typography>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <Box>
          <Typography sx={{ mb: 2, color: '#0c2340' }}>
            Please select the keywords to explore:
          </Typography>
          <Grid
            container
            spacing={1}
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              mb: 1,
            }}
          >
            {allKeywords.map((r, index) => {
              return (
                <Grid
                  item
                  xs
                  key={index}
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Chip
                    key={index}
                    label={r.replace(/\*\*/g, '')}
                    onClick={() => handleChipClick(r)}
                    color="primary"
                    variant={selectedKeywords.includes(r) ? "filled" : "outlined"}
                    sx={{
                      '& .MuiChip-label': {
                        color: '#0c2340'
                      },
                      '&.MuiChip-outlined': {
                        borderColor: '#0c2340',
                        '& .MuiChip-label': {
                          color: '#0c2340'
                        }
                      },
                      '&.MuiChip-filled': {
                        backgroundColor: '#0c2340',
                        '& .MuiChip-label': {
                          color: 'white'
                        }
                      }
                    }}
                  />
                </Grid>
              );
            })}
          </Grid>

          {promptStatus === "empty" ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Button
                variant="contained"
                sx={{
                  height: 30,
                  mt: 2,
                  justifyContent: "center",
                  alignItems: "center",
                  mb: 2,
                }}
                onClick={() => fetchDiscussionPoints()}
                disabled={selectedKeywords.length === 0}
              >
                Generate discussion points
              </Button>
            </Box>
          ) : promptStatus === "fetching" ? (
            <Box>
              <Skeleton animation="wave" />
              <Skeleton animation="wave" />
              <Skeleton animation="wave" />
              <Skeleton animation="wave" />

              <Snackbar
                open={fetchingAlertOpen}
                autoHideDuration={4000}
                onClose={handleAlertClose}
              >
                <Alert
                  onClose={handleAlertClose}
                  severity="success"
                  sx={{ width: "100%" }}
                >
                  Preparing discussion points...
                </Alert>
              </Snackbar>
            </Box>
          ) : (
            <Box id="discussion-points">
              <Typography sx={{ mb: 2, mt: 2, color: '#0c2340' }}>
                Potential discussion points:
              </Typography>
              <Box>
                <Box>
                  <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    scrollButtons="auto"
                    variant="scrollable"
                    sx={{
                      '& .MuiTabs-indicator': {
                        backgroundColor: '#0c2340',
                        color: '#0c2340'
                      },
                    }}
                  >
                    {selectedKeywords.map((r, index) => {
                      return <Tab key={index} label={r.replace(/\*\*/g, '')} color="primary" />;
                    })}
                  </Tabs>
                </Box>
                {selectedKeywords.map((r, tindex) => {
                  return (
                    <Box
                      key={tindex}
                      index={tindex}
                      hidden={tabValue !== tindex}
                      role="tabpanel"
                    >
                      {tabValue === tindex && (
                        <Box>
                          <Stack spacing={1}>
                            {prompts
                              .filter((p) => p["keyword"] === r)
                              .map((p, index) => {
                                if (
                                  index >= (page - 1) * itemPerPage &&
                                  index < page * itemPerPage
                                ) {
                                  return (
                                    <Chip
                                      key={index}
                                      label={p["prompt"].replace(/\*\*/g, '')}
                                      onClick={() =>
                                        dispatch(
                                          handleSelectedPromptsChanged(p)
                                        )
                                      }
                                      color="primary"
                                      variant={
                                        selectedPrompts.includes(p)
                                          ? "filled"
                                          : "outlined"
                                      }
                                      sx={{
                      '& .MuiChip-label': {
                        color: '#0c2340'
                      },
                      '&.MuiChip-outlined': {
                        borderColor: '#0c2340',
                        '& .MuiChip-label': {
                          color: '#0c2340'
                        }
                      },
                      '&.MuiChip-filled': {
                        backgroundColor: '#0c2340',
                        '& .MuiChip-label': {
                          color: 'white'
                        }
                      }
                    }}
                                    />
                                  );
                                }
                              })}
                          </Stack>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              mt: 2,
                            }}
                          >
                            <Pagination
                              count={Math.ceil(
                                prompts.filter((p) => p["keyword"] === r)
                                  .length / itemPerPage
                              )}
                              page={page}
                              onChange={handlePageChange}
                            />
                          </Box>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Button
                  variant="contained"
                  sx={{
                    height: 30,
                    mt: 2,
                    justifyContent: "center",
                    alignItems: "center",
                    mb: 2,
                  }}
                  onClick={handleContentSketchingClicked}
                  disabled={disableSketch()}
                >
                  Sketch content
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </div>
  );
}
