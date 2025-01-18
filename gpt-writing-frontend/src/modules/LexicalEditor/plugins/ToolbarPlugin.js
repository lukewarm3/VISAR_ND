import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $createTextNode,
  $createCodeHighlightNode,
  createCommand,
} from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  setEditorSliceStates,
  setFlowModalOpen,
  setMindmapClose,
  setMindmapOpen,
  setSaveModalOpen,
} from "../slices/EditorSlice";
import store from "../../../reducers/store";
import {
  $isParentElementRTL,
  $wrapNodes,
  $isAtNodeEnd,
} from "@lexical/selection";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
} from "@lexical/list";
import { createPortal } from "react-dom";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
} from "@lexical/rich-text";
import {
  $createCodeNode,
  $isCodeNode,
  getDefaultCodeLanguage,
  getCodeLanguages,
} from "@lexical/code";
import ConnectWithoutContactIcon from "@mui/icons-material/ConnectWithoutContact";
import {
  assignNewEditorNodeKeyToMapping,
  getEditorStateWithKeys,
  parseEditorStateWithKeys,
  selectTextNodeByKey,
} from "../utils";
import { Button, Tooltip } from "@mui/material";
import ArrowCircleRightOutlinedIcon from "@mui/icons-material/ArrowCircleRightOutlined";
import ArrowCircleLeftOutlinedIcon from "@mui/icons-material/ArrowCircleLeftOutlined";
import { useDispatch, useSelector } from "react-redux";
import {
  extendFlowEditorNodeMapping,
  setFlowSliceStates,
} from "../slices/FlowSlice";
import { setIntroSliceStates, replayTutorial } from "../slices/IntroSlice";
import { IconButton, Menu, MenuItem } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useNavigate, useLocation } from 'react-router-dom';
import HelpIcon from '@mui/icons-material/Help';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountSettingsModal from '../../../components/AccountSettingsModal';
import DraftSelectionModal from '../widgets/DraftSelectionModal';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';

const LowPriority = 1;

const GEN_TEXT_COMMAND = createCommand();

const supportedBlockTypes = new Set([
  "paragraph",
  "quote",
  "code",
  "h1",
  "h2",
  "ul",
  "ol",
]);

const blockTypeToBlockName = {
  code: "Code Block",
  h1: "Large Heading",
  h2: "Small Heading",
  h3: "Heading",
  h4: "Heading",
  h5: "Heading",
  ol: "Numbered List",
  paragraph: "Normal",
  quote: "Quote",
  ul: "Bulleted List",
};

const ndBlue = '#0C2340';
const ndGold = '#C99700';

function Divider() {
  return <div className="divider" />;
}

function positionEditorElement(editor, rect) {
  if (rect === null) {
    editor.style.opacity = "0";
    editor.style.top = "-1000px";
    editor.style.left = "-1000px";
  } else {
    editor.style.opacity = "1";
    editor.style.top = `${rect.top + rect.height + window.pageYOffset + 10}px`;
    editor.style.left = `${
      rect.left + window.pageXOffset - editor.offsetWidth / 2 + rect.width / 2
    }px`;
  }
}

function FloatingLinkEditor({ editor }) {
  const editorRef = useRef(null);
  const inputRef = useRef(null);
  const mouseDownRef = useRef(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [isEditMode, setEditMode] = useState(false);
  const [lastSelection, setLastSelection] = useState(null);

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent)) {
        setLinkUrl(parent.getURL());
      } else if ($isLinkNode(node)) {
        setLinkUrl(node.getURL());
      } else {
        setLinkUrl("");
      }
    }
    const editorElem = editorRef.current;
    const nativeSelection = window.getSelection();
    const activeElement = document.activeElement;

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    if (
      selection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const domRange = nativeSelection.getRangeAt(0);
      let rect;
      if (nativeSelection.anchorNode === rootElement) {
        let inner = rootElement;
        while (inner.firstElementChild != null) {
          inner = inner.firstElementChild;
        }
        rect = inner.getBoundingClientRect();
      } else {
        rect = domRange.getBoundingClientRect();
      }

      if (!mouseDownRef.current) {
        positionEditorElement(editorElem, rect);
      }
      setLastSelection(selection);
    } else if (!activeElement || activeElement.className !== "link-input") {
      positionEditorElement(editorElem, null);
      setLastSelection(null);
      setEditMode(false);
      setLinkUrl("");
    }

    return true;
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateLinkEditor();
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditor();
          return true;
        },
        LowPriority
      )
    );
  }, [editor, updateLinkEditor]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateLinkEditor();
    });
  }, [editor, updateLinkEditor]);

  useEffect(() => {
    if (isEditMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditMode]);

  return (
    <div ref={editorRef} className="link-editor">
      {isEditMode ? (
        <input
          ref={inputRef}
          className="link-input"
          value={linkUrl}
          onChange={(event) => {
            setLinkUrl(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (lastSelection !== null) {
                if (linkUrl !== "") {
                  editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
                }
                setEditMode(false);
              }
            } else if (event.key === "Escape") {
              event.preventDefault();
              setEditMode(false);
            }
          }}
        />
      ) : (
        <>
          <div className="link-input">
            <a href={linkUrl} target="_blank" rel="noopener noreferrer">
              {linkUrl}
            </a>
            <div
              className="link-edit"
              role="button"
              tabIndex={0}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setEditMode(true);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CodeLanguageSelect({ onChange, className, options, value }) {
  return (
    <select className={className} onChange={onChange} value={value}>
      <option hidden={true} value="" />
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function getSelectedNode(selection) {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode;
  } else {
    return $isAtNodeEnd(anchor) ? focusNode : anchorNode;
  }
}

function BlockOptionsDropdownList({
  editor,
  blockType,
  toolbarRef,
  setShowBlockOptionsDropDown,
}) {
  const dropDownRef = useRef(null);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    const dropDown = dropDownRef.current;

    if (toolbar !== null && dropDown !== null) {
      const { top, left } = toolbar.getBoundingClientRect();
      dropDown.style.top = `${top + 40}px`;
      dropDown.style.left = `${left}px`;
    }
  }, [dropDownRef, toolbarRef]);

  useEffect(() => {
    const dropDown = dropDownRef.current;
    const toolbar = toolbarRef.current;

    if (dropDown !== null && toolbar !== null) {
      const handle = (event) => {
        const target = event.target;

        if (!dropDown.contains(target) && !toolbar.contains(target)) {
          setShowBlockOptionsDropDown(false);
        }
      };
      document.addEventListener("click", handle);

      return () => {
        document.removeEventListener("click", handle);
      };
    }
  }, [dropDownRef, setShowBlockOptionsDropDown, toolbarRef]);

  const formatParagraph = () => {
    if (blockType !== "paragraph") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createParagraphNode());
        }
      });
    }
    setShowBlockOptionsDropDown(false);
  };

  const formatLargeHeading = () => {
    if (blockType !== "h1") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode("h1"));
        }
      });
    }
    setShowBlockOptionsDropDown(false);
  };

  const formatSmallHeading = () => {
    if (blockType !== "h2") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode("h2"));
        }
      });
    }
    setShowBlockOptionsDropDown(false);
  };

  const formatBulletList = () => {
    if (blockType !== "ul") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND);
    }
    setShowBlockOptionsDropDown(false);
  };

  const formatNumberedList = () => {
    if (blockType !== "ol") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND);
    }
    setShowBlockOptionsDropDown(false);
  };

  const formatQuote = () => {
    if (blockType !== "quote") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createQuoteNode());
        }
      });
    }
    setShowBlockOptionsDropDown(false);
  };

  const formatCode = () => {
    if (blockType !== "code") {
      editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createCodeNode());
        }
      });
    }
    setShowBlockOptionsDropDown(false);
  };

  return (
    <div className="dropdown" ref={dropDownRef}>
      <button className="item" onClick={formatParagraph}>
        <span className="icon paragraph" />
        <span className="text">Normal</span>
        {blockType === "paragraph" && <span className="active" />}
      </button>
      <button className="item" onClick={formatLargeHeading}>
        <span className="icon large-heading" />
        <span className="text">Large Heading</span>
        {blockType === "h1" && <span className="active" />}
      </button>
      <button className="item" onClick={formatSmallHeading}>
        <span className="icon small-heading" />
        <span className="text">Small Heading</span>
        {blockType === "h2" && <span className="active" />}
      </button>
      <button className="item" onClick={formatBulletList}>
        <span className="icon bullet-list" />
        <span className="text">Bullet List</span>
        {blockType === "ul" && <span className="active" />}
      </button>
      <button className="item" onClick={formatNumberedList}>
        <span className="icon numbered-list" />
        <span className="text">Numbered List</span>
        {blockType === "ol" && <span className="active" />}
      </button>
      <button className="item" onClick={formatQuote}>
        <span className="icon quote" />
        <span className="text">Quote</span>
        {blockType === "quote" && <span className="active" />}
      </button>
      <button className="item" onClick={formatCode}>
        <span className="icon code" />
        <span className="text">Code Block</span>
        {blockType === "code" && <span className="active" />}
      </button>
    </div>
  );
}

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [blockType, setBlockType] = useState("paragraph");
  const [selectedElementKey, setSelectedElementKey] = useState(null);
  const [showBlockOptionsDropDown, setShowBlockOptionsDropDown] =
    useState(false);
  const condition = useSelector((state) => state.editor.condition);
  const [codeLanguage, setCodeLanguage] = useState("");
  const [isRTL, setIsRTL] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const dispatch = useDispatch();
  const mindMapOpen = useSelector((state) => state.editor.mindmapOpen);
  const username = useSelector((state) => state.editor.username);
  const location = useLocation();
  const sessionId = useSelector((state) => state.editor.sessionId);
  const dependencyGraph = useSelector((state) => state.flow.dependencyGraph);
  const nodeMapping = useSelector((state) => state.flow.flowEditorNodeMapping);

  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const isTeacher = location.state?.role === 'teacher';
  const userId = isTeacher ? location.state?.teacherId : location.state?.userId;

  console.log("isTeacher :", isTeacher)

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    navigate('/');
  };

  const handleGoToDashboard = () => {
    navigate('/teacher', { 
      state: { 
        teacherId: location.state.teacherId,
        role: location.state.role,
        username: location.state.username 
      } 
    });
  };

  const handleReplayTutorial = () => {
    dispatch(replayTutorial());
  };

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM !== null) {
        setSelectedElementKey(elementKey);
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode);
          const type = parentList ? parentList.getTag() : element.getTag();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType();
          setBlockType(type);
          if ($isCodeNode(element)) {
            setCodeLanguage(element.getLanguage() || getDefaultCodeLanguage());
          }
        }
      }
      // Update text format
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));
      setIsRTL($isParentElementRTL(selection));

      // Update links
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }
    }
  }, [editor]);

  const genTextFromGPT = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      // console.log(`selection: ${selection.getTextContent()}`)

      const fetchPromise = fetch(
        "http://104.197.53.248:8088/?" +
          new URLSearchParams({
            prompt: selection.getTextContent(),
          }),
        {
          mode: "cors",
        }
      );

      fetchPromise
        .then((res) => {
          return res.json();
        })
        .then((res) => {
          const text = res["response"].trim();

          editor.update(() => {
            // console.log(`gpt response: ${text}`)

            const root = $getRoot();

            // Create a new ParagraphNode
            const paragraphNode = $createParagraphNode();

            // Create a new TextNode
            const textNode = $createTextNode(text);

            // Append the text node to the paragraph
            paragraphNode.append(textNode);

            // Finally, append the paragraph to the root
            root.append(paragraphNode);
          });
        });
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, newEditor) => {
          updateToolbar();
          return false;
        },
        LowPriority
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        LowPriority
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        LowPriority
      ),
      editor.registerCommand(
        GEN_TEXT_COMMAND,
        (payload) => {
          // genTextFromGPT();
          selectTextNodeByKey(editor, "1");
          return false;
        },
        LowPriority
      )
    );
  }, [editor, updateToolbar]);

  const codeLanguges = useMemo(() => getCodeLanguages(), []);
  const onCodeLanguageSelect = useCallback(
    (e) => {
      editor.update(() => {
        if (selectedElementKey !== null) {
          const node = $getNodeByKey(selectedElementKey);
          if ($isCodeNode(node)) {
            node.setLanguage(e.target.value);
          }
        }
      });
    },
    [editor, selectedElementKey]
  );

  const insertLink = useCallback(() => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  const generateText = useCallback(() => {
    editor.dispatchCommand(GEN_TEXT_COMMAND, null);
  }, [editor, isPredicting]);

  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);

  const handleSave = async (editor) => {
    editor.update(() => {
      const root = $getRoot();
      const editorState = editor.getEditorState().toJSON();
      const flowSlice = store.getState().flow;
      const editorSlice = store.getState().editor;
      const introSlice = store.getState().intro;

      if (!username || !sessionId) {
        console.error('Missing required session data', {
          username,
          sessionId
        });
        return;
      }

      fetch("http://127.0.0.1:5000/saveDraft", {
        method: "POST",
        mode: "cors",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username,
          sessionId,
          draft: root.getTextContent(),
          depGraph: JSON.stringify(dependencyGraph),
          editorState: JSON.stringify(editorState),
          flowSlice: JSON.stringify(flowSlice),
          editorSlice: JSON.stringify(editorSlice),
          introSlice: JSON.stringify({...introSlice, introInstance: null}),
          condition: condition,
        }),
      })
      .then((res) => res.json())
      .then((res) => {
        if (res.status === "success") {
          dispatch(setSaveModalOpen());
        } else {
          console.error('Save failed:', res.message);
        }
      })
      .catch(err => {
        console.error('Save error:', err);
      });
    });
  };

  const [drafts, setDrafts] = useState([]);
  const [draftSelectionOpen, setDraftSelectionOpen] = useState(false);
  const [saveDraftOpen, setSaveDraftOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [saveOption, setSaveOption] = useState("new");

  const loadDraftsData = useCallback(() => {
    return fetch(`http://127.0.0.1:5000/drafts?username=${username}`)
      .then(res => res.json())
      .then(res => {
        if (res.status === "success") {
          setDrafts(res.drafts);
          setDraftSelectionOpen(true);
          return res.drafts;
        }
        return [];
      });
  }, [username]);

  const handleDraftSelect = useCallback((draftId) => {
    fetch("http://127.0.0.1:5000/loadDraft", {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username,
        draftId
      }),
    })
    .then(res => res.json())
    .then(res => {
      if (res.status === "success") {
        try {
          // Parse the stored data first
          const editorState = JSON.parse(res.editorState);
          const flowSlice = JSON.parse(res.flowSlice || '{}');
          const editorSlice = JSON.parse(res.editorSlice || '{}');
          const introSlice = JSON.parse(res.introSlice || '{}');
          
          // Properly update editor state
          editor.update(() => {
            const parsedState = editor.parseEditorState(editorState);
            editor.setEditorState(parsedState);
          });
          
          // Update Redux store slices
          dispatch(setFlowSliceStates({
            nodes: flowSlice.nodes || [],
            edges: flowSlice.edges || [],
            flowEditorNodeMapping: flowSlice.flowEditorNodeMapping || {},
            ...flowSlice
          }));
          
          dispatch(setEditorSliceStates({
            selectedCounterArguments: editorSlice.selectedCounterArguments || [],
            alternativeArguments: editorSlice.alternativeArguments || [],
            ...editorSlice
          }));
          
          dispatch(setIntroSliceStates({
            ...introSlice
          }));

          setDraftSelectionOpen(false);
        } catch (error) {
          console.error('Error parsing draft data:', error);
        }
      }
    });
  }, [editor, username, dispatch]);

  const handleSaveDraft = useCallback(() => {
    if (saveOption === "new" && !draftTitle.trim()) return;
    
    editor.update(() => {
      const editorState = editor.getEditorState();
      const flowState = store.getState().flow;
      const editorSliceState = store.getState().editor;
      const introState = store.getState().intro;

      const cleanIntroState = {
        ...introState,
        introInstance: null,
        steps: introState.steps ? introState.steps.map(step => ({
          ...step,
          element: undefined
        })) : []
      };

      const cleanEditorState = {
        ...editorSliceState,
        saveModalOpen: false,
        flowModalOpen: false
      };

      const cleanFlowState = {
        nodes: flowState.nodes || [],
        edges: flowState.edges || [],
        flowEditorNodeMapping: flowState.flowEditorNodeMapping || {},
        depGraph: flowState.depGraph || {}
      };

      const saveData = {
        username,
        draftId: saveOption === "new" ? null : saveOption,
        title: saveOption === "new" ? draftTitle : drafts.find(d => d.id === saveOption)?.title,
        draft: JSON.stringify(editorState),
        depGraph: JSON.stringify(cleanFlowState.depGraph),
        editorState: JSON.stringify(editorState),
        flowSlice: JSON.stringify(cleanFlowState),
        editorSlice: JSON.stringify(cleanEditorState),
        introSlice: JSON.stringify(cleanIntroState),
        condition: "experimental"
      };
      
      fetch("http://127.0.0.1:5000/saveDraft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify(saveData)
      })
      .then(res => res.json())
      .then(res => {
        if (res.status === "success") {
          dispatch(setSaveModalOpen({ message: 'Draft saved successfully!' }));
        }
      });
    });
    setDraftTitle('');
    setSaveDraftOpen(false);
    setDraftTitle('');
    setSaveOption("new");
  }, [editor, draftTitle, saveOption, username, dispatch, drafts]);

  const handleDeleteDraft = useCallback((draftId) => {
    fetch("http://127.0.0.1:5000/deleteDraft", {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username,
        draftId
      }),
    })
    .then(res => res.json())
    .then(res => {
      if (res.status === "success") {
        setDrafts(drafts.filter(d => d.id !== draftId));
        setDraftSelectionOpen(false);
        dispatch(setSaveModalOpen('Draft deleted successfully!'));
      }
    });
  }, [username, drafts, dispatch]);

  useEffect(() => {
    const loadInitialDrafts = async () => {
      if (username) {
        try {
          const res = await fetch(`http://127.0.0.1:5000/drafts?username=${username}`);
          const data = await res.json();
          if (data.status === "success") {
            setDrafts(data.drafts);
          }
        } catch (error) {
          console.error('Error loading initial drafts:', error);
        }
      }
    };

    loadInitialDrafts();
  }, [username]);

  return (
    <div className="toolbar-wrapper" ref={toolbarRef}>
      <div className="toolbar">
        <Tooltip title="Undo">
          <button
            disabled={!canUndo}
            onClick={() => {
              editor.dispatchCommand(UNDO_COMMAND);
            }}
            className="toolbar-item spaced"
            aria-label="Undo"
          >
            <i className="format undo" />
          </button>
        </Tooltip>
        
        <Tooltip title="Redo">
          <button
            disabled={!canRedo}
            onClick={() => {
              editor.dispatchCommand(REDO_COMMAND);
            }}
            className="toolbar-item"
            aria-label="Redo"
          >
            <i className="format redo" />
          </button>
        </Tooltip>
        
        <Divider />
        
        {!mindMapOpen && (
          <>
            <Tooltip title="Text Format">
              <button
                className="toolbar-item block-controls"
                onClick={() => setShowBlockOptionsDropDown(!showBlockOptionsDropDown)}
                aria-label="Formatting Options"
              >
                <span className={"icon block-type " + blockType} />
                <span className="text">{blockTypeToBlockName[blockType]}</span>
                <i className="chevron-down" />
              </button>
            </Tooltip>
            {showBlockOptionsDropDown &&
              createPortal(
                <BlockOptionsDropdownList
                  editor={editor}
                  blockType={blockType}
                  toolbarRef={toolbarRef}
                  setShowBlockOptionsDropDown={setShowBlockOptionsDropDown}
                />,
                document.body
              )}
            
            <Divider />
            
            <Tooltip title="Bold">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
                }}
                className={"toolbar-item spaced " + (isBold ? "active" : "")}
                aria-label="Format Bold"
              >
                <i className="format bold" />
              </button>
            </Tooltip>
            
            <Tooltip title="Italic">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
                }}
                className={"toolbar-item spaced " + (isItalic ? "active" : "")}
                aria-label="Format Italics"
              >
                <i className="format italic" />
              </button>
            </Tooltip>
            
            <Tooltip title="Underline">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
                }}
                className={"toolbar-item spaced " + (isUnderline ? "active" : "")}
                aria-label="Format Underline"
              >
                <i className="format underline" />
              </button>
            </Tooltip>
            
            <Tooltip title="Strikethrough">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
                }}
                className={"toolbar-item spaced " + (isStrikethrough ? "active" : "")}
                aria-label="Format Strikethrough"
              >
                <i className="format strikethrough" />
              </button>
            </Tooltip>
            
            <Tooltip title="Code">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
                }}
                className={"toolbar-item spaced " + (isCode ? "active" : "")}
                aria-label="Insert Code"
              >
                <i className="format code" />
              </button>
            </Tooltip>
            
            <Tooltip title="Insert Link">
              <button
                onClick={insertLink}
                className={"toolbar-item spaced " + (isLink ? "active" : "")}
                aria-label="Insert Link"
              >
                <i className="format link" />
              </button>
            </Tooltip>
            
            <Divider />
            
            <Tooltip title="Left Align">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left");
                }}
                className="toolbar-item spaced"
                aria-label="Left Align"
              >
                <i className="format left-align" />
              </button>
            </Tooltip>
            
            <Tooltip title="Center Align">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center");
                }}
                className="toolbar-item spaced"
                aria-label="Center Align"
              >
                <i className="format center-align" />
              </button>
            </Tooltip>
            
            <Tooltip title="Right Align">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right");
                }}
                className="toolbar-item spaced"
                aria-label="Right Align"
              >
                <i className="format right-align" />
              </button>
            </Tooltip>
            
            <Tooltip title="Justify">
              <button
                onClick={() => {
                  editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify");
                }}
                className="toolbar-item"
                aria-label="Justify Align"
              >
                <i className="format justify-align" />
              </button>
            </Tooltip>
          </>
        )}

        <Tooltip title="Load Draft">
          <button
            className="toolbar-item"
            aria-label="Load Draft"
            onClick={loadDraftsData}
          >
            <FolderOpenIcon sx={{ color: 'white', width: 20, height: 20 }} />
          </button>
        </Tooltip>
        
        <Tooltip title="Save Draft">
          <button
            className="toolbar-item"
            aria-label="Save Draft"
            onClick={() => setSaveDraftOpen(true)}
          >
            <SaveIcon id="save" sx={{ color: 'white', width: 20, height: 20 }} />
          </button>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="toolbar-right">
          {!mindMapOpen ? (
            <Tooltip title="Show mindmap" placement="top">
              <IconButton
                className="toolbar-item"
                sx={{ 
                  ml: 1,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: ndGold,
                    color: ndBlue
                  }
                }}
                onClick={() => dispatch(setMindmapOpen())}
              >
                <ArrowCircleLeftOutlinedIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Hide mindmap" placement="top">
              <IconButton
                className="toolbar-item"
                sx={{ 
                  ml: 1,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: ndGold,
                    color: ndBlue
                  }
                }}
                onClick={() => dispatch(setMindmapClose())}
              >
                <ArrowCircleRightOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
        </div>
        {location.state?.role === 'teacher' && !mindMapOpen && (
          <Tooltip title="Go to Dashboard">
            <IconButton 
              onClick={handleGoToDashboard}
              sx={{ 
                ml: 1,
                color: 'white',
                '&:hover': {
                  backgroundColor: ndGold,
                  color: ndBlue
                }
              }}
            >
              <DashboardIcon />
            </IconButton>
          </Tooltip>
        )}
        {!mindMapOpen && (
          <>
            <Tooltip title="Help">
              <IconButton
                onClick={handleReplayTutorial}
                sx={{ 
                  ml: 1,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: ndGold,
                    color: ndBlue
                  }
                }}
              >
                <HelpIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Account Settings">
              <IconButton
                onClick={() => setAccountSettingsOpen(true)}
                sx={{ 
                  ml: 1,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: ndGold,
                    color: ndBlue
                  }
                }}
              >
                <AccountCircleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Logout">
              <IconButton
                onClick={handleLogout}
                sx={{ 
                  ml: 1,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: ndGold,
                    color: ndBlue
                  }
                }}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
        <AccountSettingsModal 
          open={accountSettingsOpen}
          onClose={() => setAccountSettingsOpen(false)}
          userId={location.state?.teacherId || location.state?.userId}
          role={location.state?.role}
        />
      </div>
      <DraftSelectionModal 
        open={draftSelectionOpen}
        onClose={() => setDraftSelectionOpen(false)}
        drafts={drafts}
        onSelect={handleDraftSelect}
        onDelete={handleDeleteDraft}
      />
      <Dialog 
        open={saveDraftOpen} 
        onClose={() => setSaveDraftOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 1,
            '& .MuiDialogTitle-root': {
              backgroundColor: ndBlue,
              color: 'white'
            }
          }
        }}
      >
        <DialogTitle>Save Draft</DialogTitle>
        <DialogContent sx={{ mt: 3, p: 3 }}>
          <FormControl fullWidth sx={{ mb: 2, marginTop: 1 }}>
            <InputLabel 
              id="save-option-label"
              sx={{ 
                backgroundColor: 'white',
                px: 1,
                paddingTop: 0,
                color: ndBlue,
                '&.Mui-focused': {
                  color: ndGold
                }
              }}
            >
              Save Option
            </InputLabel>
            <Select
              labelId="save-option-label"
              value={saveOption}
              label="Save Option"
              onChange={(e) => setSaveOption(e.target.value)}
              sx={{
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: ndGold,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: ndGold,
                },
              }}
            >
              <MenuItem value="new">Save as New Draft</MenuItem>
              {drafts.map((draft) => (
                <MenuItem key={draft.id} value={draft.id}>
                  Update "{draft.title}"
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {saveOption === "new" && (
            <TextField
              autoFocus
              fullWidth
              label="Draft Title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: ndGold,
                  },
                  '&:hover fieldset': {
                    borderColor: ndGold,
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: ndGold,
                },
              }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setSaveDraftOpen(false)}
            variant="outlined"
            sx={{ 
              color: ndBlue, 
              borderColor: ndBlue,
              '&:hover': {
                backgroundColor: '#ffebee',
                borderColor: '#c62828',
                color: '#c62828'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveDraft}
            variant="contained"
            sx={{ 
              bgcolor: ndBlue,
              '&:hover': {
                bgcolor: ndGold
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
