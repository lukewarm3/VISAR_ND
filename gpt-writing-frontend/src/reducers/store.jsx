import { configureStore } from '@reduxjs/toolkit'
import EditorReducer from '../modules/LexicalEditor/slices/EditorSlice'
import FlowReducer from '../modules/LexicalEditor/slices/FlowSlice'
import IntroReducer from '../modules/LexicalEditor/slices/IntroSlice'

export default configureStore({
    reducer: {
        editor: EditorReducer,
        flow: FlowReducer,
        intro: IntroReducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false
    })
})
