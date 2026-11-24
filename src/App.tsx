import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Host from './pages/Host';
import Play from './pages/Play';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host/:code" element={<Host />} />
      <Route path="/play" element={<Play />} />
      <Route path="/play/:code" element={<Play />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
