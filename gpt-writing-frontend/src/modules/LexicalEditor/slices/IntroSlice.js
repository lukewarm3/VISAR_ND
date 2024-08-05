import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  stepsEnabled: true,
  currentStep: 0,
  steps: [
    {
      title: "Welcome to VISAR! 👋",
      intro:
        "A human-AI collaboration system to support argumentative writing plan.",
    },
    { element: ".toolbar-wrapper", intro: "This is the toolbar."},
    { element: ".toolbar", intro: "test" },
    {element: "#save", intro: "This is the \"save draft\" button. \nPlease save your draft constantly so you will not lose your progress."},
    { element: ".toolbar-right", intro: "You can open or close the mind map by clicking this." }
  ],
};

const introSlice = createSlice({
  name: "intro",
  initialState,
  reducers: {
    enableSteps: (state) => {
      state.stepsEnabled = true;
    },
    disableSteps: (state) => {
      state.stepsEnabled = false;
    },
    setCurrentStep: (state, action) => {
      state.currentStep = action.payload;
    },
  },
});

export const { enableSteps, disableSteps, setCurrentStep } = introSlice.actions;

export default introSlice.reducer;
