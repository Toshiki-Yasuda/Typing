import { HashRouter, Route, Routes } from 'react-router';
import { BossRoute } from '@/screens/BossRoute';
import { DailyRoute } from '@/screens/DailyRoute';
import { Home } from '@/screens/Home';
import { PlayRoute } from '@/screens/PlayRoute';
import { Result } from '@/screens/Result';
import { Stats } from '@/screens/Stats';
import { StoreProvider } from './StoreContext';

/** GitHub Pages で動くよう、URL は `#/...` 形式（ハッシュルーティング）にする */
export function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<PlayRoute />} />
          <Route path="/boss/:id" element={<BossRoute />} />
          <Route path="/daily" element={<DailyRoute />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
