import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import Modal from "@mui/material/Modal";
import "reactflow/dist/style.css";
import { useDispatch, useSelector } from "react-redux";
import {
  setFlowModalOpen,
  setFlowModalClose,
  resetCounterArguments,
  resetSupportingArguments,
  resetPrompts,
} from "../slices/EditorSlice";
import { SHOW_LOADING_COMMAND } from "../commands/SelfDefinedCommands";
import { cyan, teal, pink, amber } from "@mui/material/colors";
import {
  onNodesChange,
  onEdgesChange,
  onConnect,
  loadNodes,
  addNode,
  generateFromSketch,
} from "../slices/FlowSlice";
import Flow from "./Flow";
import { ReactFlowProvider } from "reactflow";

export default function PromptModal() {
  const [editor] = useLexicalComposerContext();
  const dispatch = useDispatch();
  const modalOpen = useSelector((state) => state.editor.flowModalOpen);
  const selectedPrompts = useSelector((state) => state.editor.selectedPrompts);
  const firstTimeUser = useSelector((state) => state.intro.firstTimeUser);
  const introInstance = useSelector((state) => state.intro.introInstance);
  const steps = useSelector((state) => state.intro.steps);

  useEffect(() => {
    console.log("modalOpen is changed to " + modalOpen);
    if (firstTimeUser && introInstance) {
      if (modalOpen) {
        introInstance.setOptions({ disableInteraction: true, steps: steps.slice(8, 10) });

        introInstance.start();
      }
    }
  }, [modalOpen]);

  useEffect(() => {
    console.log("modal rendered");
  }, []);

  return (
    <div>
      <Modal
        id="react-flow-modal"
        open={modalOpen}
        onClose={() => {
          dispatch(setFlowModalClose());
          // dispatch(resetCounterArguments())
          // dispatch(resetSupportingArguments())
          // dispatch(resetPrompts())
        }}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <ReactFlowProvider>
          <Flow editor={editor} mode="modal" sidebar={true} />
        </ReactFlowProvider>
      </Modal>
    </div>
  );
}
