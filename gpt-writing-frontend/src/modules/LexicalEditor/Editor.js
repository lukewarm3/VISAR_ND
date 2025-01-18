import ExampleTheme from "./themes/ExampleTheme";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import TreeViewPlugin from "./plugins/TreeViewPlugin";
import ToolbarPlugin from "./plugins/ToolbarPlugin";
import EditablePlugin from "./plugins/ToggleEditablePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import {
  addClassNamesToElement,
  removeClassNamesFromElement,
} from "@lexical/utils";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import FloatingButtonPlugin from "./plugins/FloatingButtonPlugin";
import ListMaxIndentLevelPlugin from "./plugins/ListMaxIndentLevelPlugin";
import CodeHighlightPlugin from "./plugins/CodeHighlightPlugin";
import MuiAppBar from "@mui/material/AppBar";
import Drawer from "@mui/material/Drawer";
import AutoLinkPlugin from "./plugins/AutoLinkPlugin";
import "./styles.css";
import { styled, useTheme } from "@mui/material/styles";
import {
  $getSelection,
  ParagraphNode,
  TextNode,
  $getNodeByKey,
  RootNode,
  LineBreakNode,
} from "lexical";
import LoadingPlugin from "./plugins/LoadingPlugin";
import { HighlightDepNode } from "./nodes/HighlightDepNode";
import ReactFlowModal from "./widgets/ReactFlowModal";
import SaveModal from "./widgets/SaveModal";
import { useSelector, useDispatch } from "react-redux";
import Box from "@mui/material/Box";
import { useLocation } from "react-router-dom";
import ReactFlowPlugin from "./plugins/ReactFLowPlugin";
import { TextBlockNode } from "./nodes/TextBlockNode";
import { Typography } from "@mui/material";
import {
  setCurClickedNodeKey,
  setCurSelectedNodeKey,
  setIsCurNodeEditable,
  setStudyCondition,
  setUsername,
  setSessionId,
  setTaskDescription,
  setEditorSliceStates,
} from "./slices/EditorSlice";
import { clearUnusedNodeAndEdge, setFlowSliceStates, setNodeSelected } from "./slices/FlowSlice";
import SeeAlternativeModal from "./widgets/SeeAlternativeModal";
import FixWeaknessModal from "./widgets/FixWeaknessModal";
import { ADD_EXAMPLE_COMMAND } from "./commands/SelfDefinedCommands";
import RefineModal from "./widgets/RefineModal";
import ReactFlow, { useReactFlow, ReactFlowProvider } from "reactflow";
import UpdateModal from "./widgets/UpdateModal";
import { useEffect, useState } from "react";
import ManualAddNodeModal from "./widgets/ManualAddNodeModal";
import TaskDescriptionPlugin from "./plugins/TaskDescriptionPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import LoadEditorStatePlugin from "./plugins/LoadEditorStatePlugin";
import introJs from "intro.js";
import "intro.js/introjs.css";
import { disableTutorial, setCurrentStep, setFirstTimeUser, setIntroInstance, setIntroSliceStates, enableTutorial } from "./slices/IntroSlice";
import ReactFlowHistoryPlugin from "./plugins/ReactFlowHistoryPlugin";
import AccountSettingsModal from '../../components/AccountSettingsModal';

function Placeholder() {
  return <div className="editor-placeholder">Enter some rich text...</div>;
}

// Same Notre Dame colors...could probably just make this part of the global theme
const ndBlue = '#0C2340';
const ndGold = '#C99700';

const drawerWidth = "45%";

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })(
  ({ theme, open }) => ({
    flexGrow: 1,
    position: 'relative',
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginTop: "46px",
    ...(open && {
      transition: theme.transitions.create("margin", {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginRight: drawerWidth,
    }),
  })
);

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  backgroundColor: ndBlue,
  zIndex: theme.zIndex.drawer + 1,
  ...(open && {
    width: `calc(100% - ${drawerWidth})`,
    marginRight: `${drawerWidth}`,
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: "flex-start",
}));

const editorConfig = {
  // The editor theme
  theme: ExampleTheme,
  // Handling of errors during update
  onError(error) {
    throw error;
  },
  // Any custom nodes go here
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    TableNode,
    HighlightDepNode,
    TableCellNode,
    TableRowNode,
    AutoLinkNode,
    LinkNode,
    TextBlockNode,
  ],
};

export default function Editor() {
  const dispatch = useDispatch();
  const location = useLocation();
  const mindmapOpen = useSelector((state) => state.editor.mindmapOpen);
  const curSelectedNodeKey = useSelector(
    (state) => state.editor.curSelectedNodeKey
  );
  const isCurNodeEditable = useSelector(
    (state) => state.editor.isCurNodeEditable
  );
  const condition = useSelector((state) => state.editor.condition);
  const [editorState, setEditorState] = useState(null);
  const introInstance = useSelector(state=>state.intro.introInstance)
  const firstTimeUser = useSelector((state) => state.intro.firstTimeUser);
  const currentStep = useSelector((state) => state.intro.currentStep);
  const steps = useSelector((state) => state.intro.steps);
  const updateModalOpen = useSelector((state) => state.editor.updateModalOpen);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [sessionStart, setSessionStart] = useState(null);
  const [activeTime, setActiveTime] = useState(0);
  const [idleTimeout, setIdleTimeout] = useState(null);

  useEffect(() => {
    if (location.state) {
      console.log("Location state in Editor:", location.state);
      const { username, userId, sessionId, condition } = location.state;
      if (username) {
        dispatch(setUsername(username));
      }
      if (sessionId) {
        dispatch(setSessionId(sessionId));
      }
      if (condition) {
        dispatch(setStudyCondition(condition));
      }
      if (location.state?.firstTimeLogin) {
        console.log("First time login detected, enabling tutorial");
        dispatch(enableTutorial());
      }
    }
  }, [location.state, dispatch]);

  useEffect(() => {
    console.log("set condition", location.state.condition);
    if (
      location.state.condition !== null &&
      location.state.condition !== undefined
    ) {
      dispatch(setStudyCondition('advanced'));
      dispatch(setUsername(location.state.username));
      dispatch(setSessionId(location.state.sessionId));
      dispatch(setTaskDescription(location.state.taskDescription));
      if (location.state.preload === true) {
        console.log("[editor] editor state is", location.state.editorState);
        console.log("[editor] editor slice is", location.state.editorSlice);
        console.log("[editor] flow slice is", location.state.flowSlice);
        dispatch(setEditorSliceStates(location.state.editorSlice));
        dispatch(setFlowSliceStates(location.state.flowSlice));
        dispatch(clearUnusedNodeAndEdge())
        dispatch(setIntroSliceStates(location.state.introSlice))
        setEditorState(location.state.editorState);
      }
    }
  }, [location]);

  useEffect(() => {
    // Add detailed logging for tutorial initialization
    console.log("Tutorial initialization state:", {
      firstTimeUser,
      hasPreload: !!location.state?.preload,
      hasIntroInstance: !!introInstance,
      currentStep,
      steps: steps?.length
    });

    // Only initialize tutorial if we're a first-time user and not preloading state
    if (firstTimeUser && !location.state?.preload) {
      console.log("Initializing tutorial...");
      // Ensure any existing instance is cleaned up
      if (introInstance) {
        introInstance.exit();
      }

      if (currentStep === 0) {
        const intro = introJs.tour();
        intro.setOptions({
          disableInteraction: true,
          steps: steps.slice(0, 6),
          tooltipClass: "customTooltip",
          exitOnOverlayClick: false,
          exitOnEsc: false,
          showStepNumbers: true,
          tooltipPosition: 'auto',
          positionPrecedence: ['bottom', 'top', 'right', 'left'],
          showProgress: true,
          overlayOpacity: 0.8,
          dontShowAgain: false,
          scrollToElement: true,
          scrollPadding: 50
        });

        intro.oncomplete(() => {
          dispatch(disableTutorial());
          localStorage.setItem('tutorialCompleted', 'true');
        });

        intro.onexit(() => {
          if (currentStep !== 5) {
            dispatch(disableTutorial());
            localStorage.setItem('tutorialCompleted', 'true');
          }
        });

        // Small delay to ensure DOM is ready
        setTimeout(() => {
          intro.start();
          dispatch(setIntroInstance(intro));
        }, 100);

      } else if (currentStep === 5 && !updateModalOpen) {
        if (introInstance) {
          dispatch(setCurrentStep(6));
          introInstance.setOptions({
            disableInteraction: true,
            steps: steps.slice(21, 22),
          });
          introInstance.start();
        }
        dispatch(disableTutorial());
      }
    }

    return () => {
      if (introInstance) {
        introInstance.exit();
      }
    };
  }, [firstTimeUser, currentStep, updateModalOpen, location.state?.preload]);

  // Track session start and end
  useEffect(() => {
    const startTime = new Date();
    setSessionStart(startTime);
    
    return () => {
      const endTime = new Date();
      const duration = endTime - startTime;
      
      // Log session data
      fetch('http://127.0.0.1:5000/log_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: location.state?.userId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration: duration,
          active_time: activeTime
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.status !== "success") {
          console.error("Failed to log session:", data.message);
        }
      })
      .catch(err => {
        console.error("Error logging session:", err);
      });
    };
  }, [location.state?.userId]); // Add dependencies

  // Track active time
  useEffect(() => {
    let timeoutId;
    let lastActivity = Date.now();
    
    const updateActiveTime = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      
      // Only count time if less than 1 minute has passed
      if (timeSinceLastActivity < 60000) {
        setActiveTime(prev => prev + timeSinceLastActivity);
      }
      
      lastActivity = now;
    };

    const resetIdleTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        updateActiveTime();
      }
      
      timeoutId = setTimeout(() => {
        // User considered idle after 1 minute
        updateActiveTime();
      }, 60000);
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keypress', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    
    // Start initial timer
    resetIdleTimer();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        updateActiveTime();
      }
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keypress', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
    };
  }, []); // Empty dependency array since we're using refs

  useEffect(() => {
    if (location.state?.sessionId) {
      dispatch(setSessionId(location.state.sessionId));
    } else {
      // Generate a new session ID if none exists
      const newSessionId = Date.now().toString();
      dispatch(setSessionId(newSessionId));
    }
  }, []);

  const handleSaveEssay = async (content) => {
    await fetch('http://127.0.0.1:5000/log_essay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: location.state?.userId,
        title: "Essay Title", // Get this from your state
        content: content,
        keywords: [], // Get this from your state
        status: "completed"
      })
    });
  };

  const logInteraction = async (type, data) => {
    await fetch('http://127.0.0.1:5000/logInteractionData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: location.state?.username,
        sessionId: location.state?.sessionId,
        type: type,  // Make sure to use specific types for GPT interactions
        interactionData: data
      })
    });
  };
  
  return (
    <Box>
      {/* <Steps
        enabled={stepsEnabled}
        steps={steps}
        initialStep={currentStep}
        onBeforeChange={(nextStepIndex) => {
          console.log("Changing to step:", nextStepIndex);
        }}
        onBeforeExit={(nextStepIndex) => {
          return window.confirm("Are you sure you want to end the tutorial?")
        }}
        onExit={() => dispatch(disableSteps())}
      /> */}

      <LexicalComposer initialConfig={editorConfig}>
        <AppBar position="fixed" open={mindmapOpen}>
          <ToolbarPlugin />
        </AppBar>
        <Main open={mindmapOpen}>
          <div className="editor-container">
            <LoadEditorStatePlugin editorState={editorState} />
            <FloatingButtonPlugin />
            <ReactFlowHistoryPlugin />
            <LoadingPlugin />
            <div className="editor-inner">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className="editor-input"
                    style={{ height: "988px" }}
                  />
                }
                placeholder={<Placeholder />}
              />
              <HistoryPlugin />
              {/* <TaskDescriptionPlugin /> */}
              {/* <TreeViewPlugin /> */}
              {/* <ReactFlowPlugin /> */}
              <AutoFocusPlugin />
              <CodeHighlightPlugin />
              <ListPlugin />
              {/* <EditablePlugin /> */}
              <LinkPlugin />
              <AutoLinkPlugin />
              <NodeEventPlugin
                nodeType={LineBreakNode}
                eventType={"click"}
                eventListener={(e, editor, key) => {
                  console.log("line break clicked");
                  editor.setEditable(true);
                  const selection = $getSelection();
                  const child = selection.getNodes()[0];
                  dispatch(setCurClickedNodeKey(child.__key));
                }}
              />
              <NodeEventPlugin
                nodeType={TextNode}
                eventType={"click"}
                eventListener={(e, editor, key) => {
                  editor.update(() => {
                    console.log(
                      "NodeEventPlugin TextNode triggered for node key:",
                      key
                    );

                    const selection = $getSelection();
                    const child = selection.getNodes()[0];
                    console.log("text node clicked", child.__key);
                    // curClickedNodeKey is used to navigate the focus of the react flow to the corresponding node
                    dispatch(setCurClickedNodeKey(child.__key));
                    // dispatch(setCurClickedNodeKey(''))
                    editor.setEditable(true);
                    editor.focus();
                  });
                  e.stopPropagation();
                }}
              />
              <NodeEventPlugin
                nodeType={TextBlockNode}
                eventType={"click"}
                eventListener={(e, editor, key) => {
                  // console.log('flow viewport', flowInstance.getViewport())

                  editor.update(() => {
                    console.log(
                      "NodeEventPlugin textblocknode triggered for node key:",
                      key
                    );

                    if (
                      $getNodeByKey(key) === null ||
                      $getNodeByKey(key) === undefined
                    ) {
                      console.log("[editor] the event key is null");
                      return;
                    }

                    const selection = $getSelection();
                    const child = selection.getNodes()[0];
                    console.log(
                      "[editor] selection's first node (child): ",
                      child
                    );
                    dispatch(setCurClickedNodeKey(child.__key));
                    // console.log("[event listener] curSelectedNodeKey, node key, isCurNodeEditable: ", curSelectedNodeKey, child.__key, isCurNodeEditable)
                    if (
                      child.__key === curSelectedNodeKey &&
                      isCurNodeEditable
                    ) {
                      // console.log("This is the the node selected in last time")
                      editor.setEditable(true);
                      editor.focus();
                    } else {
                      // restore the default background transprancy for the last selected node
                      if (curSelectedNodeKey !== child.__key) {
                        // dispatch(setCurSelectedNodeKey(child.__key))
                        dispatch(setNodeSelected(child.__key)); // when click the HighlightNode, the HighlightNode will be wrapped by dashed green line
                        const lastSelectedNode =
                          $getNodeByKey(curSelectedNodeKey);
                        if (
                          lastSelectedNode !== null &&
                          lastSelectedNode !== undefined
                        ) {
                          lastSelectedNode.setStyle(
                            "background-color: #f9c74f;"
                          );
                        }
                      }
                      console.log("gonna disable editable");
                      editor.setEditable(false);
                      dispatch(setIsCurNodeEditable(false));
                    }
                  });
                  e.stopPropagation();
                }}
              />
              <ListMaxIndentLevelPlugin maxDepth={7} />
              <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            </div>
          </div>
        </Main>
        {condition && (
          <Drawer
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: drawerWidth,
              },
            }}
            variant="persistent"
            anchor="right"
            open={mindmapOpen}
          >
            <ReactFlowPlugin />
          </Drawer>
        )}
        <ReactFlowModal />
        <SeeAlternativeModal />
        <RefineModal />
        <FixWeaknessModal />
        <UpdateModal />
        <ManualAddNodeModal />
        <SaveModal 
          onSave={handleSaveEssay}
        />
        <AccountSettingsModal 
          open={accountSettingsOpen}
          onClose={() => setAccountSettingsOpen(false)}
          userId={location.state?.userId}
          role={location.state?.role}
          username={location.state?.username}
        />
      </LexicalComposer>
    </Box>
  );
}
