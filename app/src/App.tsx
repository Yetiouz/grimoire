import { StyleGuide } from './pages/style-guide/StyleGuide'

// Design-system stage: no real screens exist yet, so the whole app is
// the living style guide for now (CLAUDE.md: "design system before
// screens"). Routing arrives with the first real screen, not before.
function App() {
  return <StyleGuide />
}

export default App
