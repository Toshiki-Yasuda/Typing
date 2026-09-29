import { HashRouter, Route, Routes } from 'react-router';
import { Home } from '@/screens/Home';
import { Play } from '@/screens/Play';
import { Result } from '@/screens/Result';
import { StoreProvider } from './StoreContext';

/** GitHub Pages で動くよう、URL は `#/...` 形式（ハッシュルーティング）にする */
export function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
