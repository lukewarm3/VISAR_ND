import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  firstTimeUser: true,
  currentStep: 0,
  introInstance: null,
  steps: [
    // 0
    {
      title: "Welcome to VISAR! 👋",
      intro:
        "A human-AI collaboration system to support argumentative writing plan.",
    },
    // 1
    { element: ".toolbar-wrapper", intro: "This is the toolbar." },
    // 2
    {
      element: ".toolbar",
      intro: "These are the common tools used to edit text.",
    },
    // 3
    {
      element: "#save",
      intro:
        'This is the "save draft" button. <br>Please save your draft constantly so you will not lose your progress.',
    },
    // 4
    {
      element: ".toolbar-right",
      intro: "You can open or close the mind map by clicking this.",
    },
    // 5
    {
      title: 'Explore 🪜"Step-by-Step Goal Recommendation" feature',
      intro:
        'Now let\'s play with VISAR to help you write, please follow the steps:<br>1. Write a topic sentence in the editor.<br>2. Select the whole sentence.<br>3. Click the Elaborate button. <br>For example, write the topic sentence "University of Notre Dame is a great university."',
    },
    // 6
    {
      element: ".elaborate-group",
      intro:
        "Here VISAR presents you with a set of suggested key aspects to help substantiate the chosen argument. Now choose the keyword(s) you want.",
    },
    // 7
    {
      element: "#discussion-points",
      intro:
        'VISAR prepares specific discussion points for each chosen aspect. <br>You can choose the discussion points you are interested in and then click "SKETCH CONTENT" button.',
    },
    // 8
    {
      element: "#react-flow-modal",
      intro: "Here VISAR displays the current visual outline for review.",
    },
    // 9
    {
      element: "#generate-button",
      intro:
        "After reviewing and confirming the outline, you can click the generate button. VISAR will then produce the prototype write-up based on the outline.",
    },
    // 10
    {
      title: 'Explore ✨"Argumentative Sparks" feature',
      intro:
        'Moreover, VISAR can suggest Argumentative Sparks for the write-ups. <br>1. Click one of the generated discussion points (yellow highlighted text).<br>2. Click "Argumentative sparks".<br>3. Then click "Counter Arguments" under the "Argumentative Sparks" menu.',
    },
    // 11
    {
      element: "#counter-argument-menu",
      intro:
        'Select the counter argument(s) you want to implement and click "REVIEW AND SKETCH".',
    },
    // 12
    {
      title: 'Explore 📝"Visual Writing Planning" feature',
      intro:
        "To further facilitate the creation and organization of writing outlines, VISAR enables you to edit outlines visually.",
    },
    // 13
    {
      element: ".toolbar-right",
      intro: "First, open the mind map.",
    },
    // 14
    {
      element: "#add-node-panel",
      intro:
        "Then, click the button to add one node.<br><br>After adding the node, you can change the text on it and also create relationship between it and another node by dragging a line between their dots ",
    },
    // 15
    {
      title: 'Final step: explore 🛫"Rapid Draft Prototyping" feature',
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
      title: "Explore by yourself!",
      intro:
        'The basic tutorial ends! However, this does not cover everything and you can try them by yourself! For example, try the "Edit" when you click the highlighted text! <br><br>Also, try to write several related arguments as separate paragraphs and select all of them, then you will unlock the "Synthesize" feature that helps you write thesis! <br><br>Enjoy!',
    },
  ],
};

const introSlice = createSlice({
  name: "intro",
  initialState,
  reducers: {
    setIntroSliceStates: (state, action) => {
      const { firstTimeUser, currentStep, introInstance } = action.payload;

      return {
        ...state,
        firstTimeUser: firstTimeUser,
        currentStep: currentStep,
        introInstance: introInstance,
      };
    },
    enableTutorial: (state) => {
      state.firstTimeUser = true;
    },
    disableTutorial: (state) => {
      state.firstTimeUser = false;
    },
    setCurrentStep: (state, action) => {
      state.currentStep = action.payload;
    },
    setIntroInstance: (state, action) => {
      state.introInstance = action.payload;
    },
  },
});

export const {
  setIntroSliceStates,
  enableTutorial,
  disableTutorial,
  setCurrentStep,
  setIntroInstance,
} = introSlice.actions;

export default introSlice.reducer;
