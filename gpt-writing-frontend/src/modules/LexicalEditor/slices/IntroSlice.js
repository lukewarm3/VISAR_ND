import { createSlice } from "@reduxjs/toolkit";
import introJs from "intro.js";

const initialState = {
  firstTimeUser: true,
  currentStep: 0,
  introInstance: null,
  helpMode: false,
  steps: [
    // 0
    {
      title: "Welcome to VISAR! 👋",
      intro:
        "VISAR is a Human-AI co-creative writing tool that assists with argumentative writing.",
    },
    // 1
    { element: ".toolbar-wrapper", intro: "Throughout the writing process, you'll use this toolbar to edit text, save/load drafts, and configure the view of the app." },
    // 2
    {
      element: ".toolbar",
      intro: "Over here you'll find some familiar editing tools for your text.",
    },
    // 3
    {
      element: "#save",
      intro:
        'This is the <em>"save draft"</em> button. <br>Please save your draft often so you won\'t lose your progress!',
    },
    // 4
    {
      element: ".toolbar-right",
      intro: "A visual representation of your outline can also be generated.  You can view this diagram by clicking on this icon.",
    },
    // 5
    {
      title: 'Explore 🪜<em>"Step-by-Step Goal Recommendation"</em> feature',
      intro:
        'Now let\'s play with VISAR to help you reach your creative goals! Please follow the steps below:<br><br>1. Write a topic sentence in the editor.<br>2. Use your mouse to select and highlight the entire sentence.<br>3. Click the <b>Elaborate</b> button. <br><br>For example, write the topic sentence <em>"The University of Notre Dame is an excellent university."</em>',
    },
    // 6
    {
      element: ".elaborate-group",
      intro:
        "Here, VISAR presents you with a set of suggested keywords to help substantiate the chosen argument. Now let's select the keyword(s) that are relevant for your argument and click <b>'GENERATE DISCUSSION POINTS'</b>",
    },
    // 7
    {
      element: "#discussion-points",
      intro:
        'VISAR prepares specific discussion points for each chosen keyword. <br><br>You can choose the discussion points you are interested in exploring and then click <b>"SKETCH CONTENT"</b>.',
    },
    // 8
    {
      element: "#react-flow-modal",
      intro: "VISAR now displays the current visual outline for your review.",
    },
    // 9
    {
      element: "#generate-button",
      intro:
        "After reviewing and confirming the suggested outline, you can click <b>'GENERATE'</b>. <br><br>VISAR will then generate a structured text argument in the text editor based on the visual outline.",
    },
    // 10
    {
      title: 'Explore ✨"Argumentative Sparks" feature',
      intro:
        'Moreover, VISAR can suggest <em>Argumentative Sparks</em> from the writing. Please follow the steps below:<br><br>1. Click on one of the generated discussion points (yellow highlighted text).<br>2. Click <b>"Argumentative sparks"</b>.<br>3. Then click <b>"Counter Arguments"</b> under the <b>"Argumentative sparks"</b> menu.',
    },
    // 11
    {
      element: "#counter-argument-menu",
      intro:
        'Select the counter argument(s) you want to implement within your text and click <b>"REVIEW AND SKETCH"</b>.',
    },
    // 12
    {
      title: 'Explore 📝"Visual Writing Planning" feature',
      intro:
        "To further facilitate the creation and organization of writing outlines, VISAR enables you to edit outlines visually.",
    },
    // 13
    {
      element: ".mind-map",
      intro: "First, let's open the mind map by clicking on this icon.",
    },
    // 14
    {
      element: "#add-node-panel",
      intro:
        "Then, click the <b>+</b> icon to add a node.  This node will be viewed as a part of the overall argument.<br><br>After adding the node, you can change the text on it and also create relationships between itself and another nodes by dragging a line between their dots.",
    },
    // 15
    {
      title: 'One more before you go! Explore 🛫"Rapid Draft Prototyping" feature',
      intro:
        "To help you reflect on and improve your outline, VISAR can rapidly generate prototypes from the outline.",
    },
    // 16
    {
      element: "#react-flow-plugin",
      intro:
        'Try modify the text on one of the nodes and click "Done" once you finish.',
    },
    // 17
    {
      element: "#regenerate-replace-wrapper",
      intro:
        'You can regenerate the result by clicking "REGENERATE" if you are not satisfied with that, and then click the "REPLACE" to replace the text in the editor.',
    },
    // 18
    {
      element: "#prev-next-wrapper",
      intro:
        "You can also examine and update the dependent nodes in a recursive way in order to maintain consistency. <br>Try by clicking one of them.",
    },
    // 19
    {
      element: "#option-chips",
      intro:
        'Select a new topic for the dependent node and click "GENERATE TEXT".',
    },
    // 20
    {
      element: "#prev-next-wrapper",
      intro: "Similarly, regenerate the text or replace the text if you want.",
    },
    // 21
    {
      title: "Explore by yourself! ⛰️",
      intro:
        'This warps up the tutorial! Please note, this does not cover all the features, but now you have the skills to explore for yourself! Maybe try out the <b>"Edit"</b> when you click the highlighted text! <br><br>Also, maybe try to write several related arguments as separate paragraphs and select all of them, then you will unlock the <b>"Synthesize"</b> feature that helps you formulate your thesis! <br><br>Enjoy!',
    },
  ],
};

const introSlice = createSlice({
  name: "intro",
  initialState,
  reducers: {
    setIntroSliceStates: (state, action) => {
      const { firstTimeUser, currentStep, helpMode } = action.payload;

      let introInstance = state.introInstance;
      if ((firstTimeUser || helpMode) && introInstance === null) {
        introInstance = introJs.tour();
      }

      return {
        ...state,
        firstTimeUser: firstTimeUser,
        currentStep: currentStep,
        introInstance: introInstance,
        helpMode: helpMode || false,
      };
    },
    enableTutorial: (state) => {
      state.firstTimeUser = true;
      state.currentStep = 0;
    },
    disableTutorial: (state) => {
      state.firstTimeUser = false;
    },
    toggleHelpMode: (state) => {
      state.helpMode = !state.helpMode;
      if (state.introInstance) {
        state.introInstance.exit();
      }
      state.firstTimeUser = true;
      state.currentStep = 0;
      state.introInstance = null;
      localStorage.removeItem('tutorialCompleted');
    },
    setCurrentStep: (state, action) => {
      state.currentStep = action.payload;
    },
    setIntroInstance: (state, action) => {
      state.introInstance = action.payload;
    },
    replayTutorial: (state) => {
      if (state.introInstance) {
        state.introInstance.exit();
      }
      state.firstTimeUser = true;
      state.currentStep = 0;
      state.introInstance = null;
      localStorage.removeItem('tutorialCompleted');
    },
  },
});

export const {
  setIntroSliceStates,
  enableTutorial,
  disableTutorial,
  setCurrentStep,
  setIntroInstance,
  replayTutorial,
  toggleHelpMode,
} = introSlice.actions;

export default introSlice.reducer;
