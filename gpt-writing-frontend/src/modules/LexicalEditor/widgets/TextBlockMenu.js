import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDependency, getDependencies } from "../neo4j";
import { positionFloatingButton, highlightDepText } from "../utils";
import {
  SELECTION_CHANGE_COMMAND,
  $getSelection,
  $setSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $isParagraphNode,
  $isTextNode,
  $createRangeSelection,
  $getRoot,
  $createTextNode,
  createCommand,
} from "lexical";
import {
  mergeRegister,
  removeClassNamesFromElement,
  addClassNamesToElement,
} from "@lexical/utils";
import {
  ELABORATE_COMMAND,
  ADD_EXAMPLE_COMMAND,
  REWRITE_COMMAND,
  ARGUMENTATIVE_COMMAND,
  SHOW_WEAKNESS_COMMAND,
  SHOW_SUPPORT_COMMAND,
  SHOW_DEPENDENCY_COMMAND,
  SHOW_COUNTER_ARGUMENT_COMMAND,
  lowPriority,
  highPriority,
  EVIDENCE_COMMAND,
} from "../commands/SelfDefinedCommands";
import { $createHighlightDepNode } from "../nodes/HighlightDepNode";
import { $isTextBlockNode } from "../nodes/TextBlockNode";
import { $isHighlightDepNode } from "../nodes/HighlightDepNode";
import {
  resetSupportingArguments,
  setCurSelectedNodeKey,
  setIsCurNodeEditable,
  setSelectedSent,
} from "../slices/EditorSlice";
import { useDispatch, useSelector } from "react-redux";
import { setNodeSelected } from "../slices/FlowSlice";
import { Divider } from "@mui/material";
import { Stack } from "@mui/system";

export function TextBlockMenu({ editor }) {
  const buttonRef = useRef(null);
  const dispatch = useDispatch();
  const nodeData = useSelector((state) => state.flow.nodeData);
  const curSelectedNodeKey = useSelector(
    (state) => state.editor.curSelectedNodeKey
  );
  const isCurNodeEditable = useSelector(
    (state) => state.editor.isCurNodeEditable
  );

  // const showDependencies = useCallback(() => {
  //   const selection = $getSelection()

  //   const node = selection.getNodes()[0]

  //   getDependencies(node).then(res => {
  //     highlightDepText(editor, res)
  //   })

  //   // highlightText(editor, selection.getTextContent(), undefined, undefined, "highlight-dep-elb")

  //   // console.log(`selection content: ${selection.getTextContent()}`)

  //   // node.setStyle(" background-color: #cdb4db; padding: 1px 0.25rem; font-family: Menlo, Consolas, Monaco, monospace; font-size: 94%; border-radius: 25px;");
  // }, [editor])

  // callback updating floating button position
  const updateTextBlockMenu = useCallback(() => {
    const selection = $getSelection();

    console.log("[textblock menu] updateTextBlockMenu called");

    if (selection === null) {
      console.log("[textblock menu] selection is null");
      return;
    }

    const children = selection.getNodes();

    if ($isHighlightDepNode(children[0])) {
      // dispatch(setCurSelectedNodeKey(children[0].__key))
      dispatch(setSelectedSent(children[0].getTextContent())); // selectedSent is used in rewriteModal
    }

    const buttonElem = buttonRef.current;
    const nativeSelection = window.getSelection();
    let hasHighlightDepNode = false;

    if (children[0].__key === curSelectedNodeKey && isCurNodeEditable) {
      console.log(
        "curSelectedNodeKey, nodeKey, isCurEditable: ",
        curSelectedNodeKey,
        children[0].__key,
        isCurNodeEditable
      );
      console.log("[textblockmenu] gonna hide the text block menu");
      positionFloatingButton(buttonElem, null);
      return;
    }

    children.map((child) => {
      if ($isHighlightDepNode(child)) {
        hasHighlightDepNode = true;
      }
    });

    if (buttonElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    const domRange =
      nativeSelection.rangeCount > 0 ? nativeSelection.getRangeAt(0) : null;
    if (
      selection != null &&
      selection.anchor.offset === selection.focus.offset &&
      hasHighlightDepNode &&
      // !nativeSelection.isCollapsed &&
      rootElement != null &&
      rootElement.contains(nativeSelection.anchorNode) &&
      domRange
    ) {
      console.log("text menu shown");
      console.log(
        "curSelectedNodeKey and nodeKey: ",
        curSelectedNodeKey,
        children[0].__key
      );

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
      // editor.setEditable(false)
      positionFloatingButton(buttonElem, rect);
    } else {
      positionFloatingButton(buttonElem, null);
    }

    return true;
  }, [editor, curSelectedNodeKey, isCurNodeEditable]);

  useEffect(() => {
    const buttonElem = buttonRef.current;

    // editor.getEditorState().read(() => {
    //   positionFloatingButton(buttonElem, null)
    // })

    return mergeRegister(
      // editor.registerUpdateListener(({ editorState }) => {
      //   editorState.read(() => {
      //     // updateTextBlockMenu()
      //   })
      // }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = $getSelection();
          const nodes = selection.getNodes();
          const node = nodes[0];
          // dispatch(setCurSelectedNodeKey(node.__key))
          console.log("[textblock menu] selection changed");
          updateTextBlockMenu();
          return false;
        },
        highPriority
      )
    );
  }, [editor, updateTextBlockMenu]);

  // useEffect(() => {
  //   editor.update(() => {
  //     console.log("[textblock menu] nodedata changed changed")
  //     updateTextBlockMenu()
  //   })
  // }, [isCurNodeEditable])

  return (
    <div className="floatbuttongroup" ref={buttonRef} sx={{ display: "flex" }}>
      <button
        className="float-item"
        onClick={() => {
          editor.update(() => {
            const selection = $getSelection();
            const nodes = selection.getNodes();
            const node = nodes[0];
            console.log("[text block menu] node is ", node, node.__key)
            dispatch(setCurSelectedNodeKey(node.__key));
            dispatch(setNodeSelected(node.__key));
            editor.dispatchCommand(REWRITE_COMMAND, null);
            positionFloatingButton(buttonRef.current, null);
          });
        }}
      >
        Edit
      </button>

      <Divider orientation="vertical" />

      <button
        className="float-item"
        onClick={() => {
          editor.update(() => {
            const selection = $getSelection();
            const nodes = selection.getNodes();
            const node = nodes[0];
            dispatch(setCurSelectedNodeKey(node.__key));
            dispatch(setNodeSelected(node.__key));
            editor.dispatchCommand(ARGUMENTATIVE_COMMAND, null);
            positionFloatingButton(buttonRef.current, null);
          });
        }}
      >
        Argumentative sparks
      </button>
    </div>
  );
}
