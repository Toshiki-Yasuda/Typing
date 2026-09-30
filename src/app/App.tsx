import { HashRouter, Route, Routes } from 'react-router';
import { BossRoute } from '@/screens/BossRoute';
import { DailyRoute } from '@/screens/DailyRoute';
import { Home } from '@/screens/Home';
import { PlayRoute } from '@/screens/PlayRoute';
import { Result } from '@/screens/Result';
import { StageRoute } from '@/screens/stage/StageRoute';
import { StageSelectRoute } from '@/screens/stage/StageSelect';
import { DiagnosisScreen } from '@/screens/diagnosis/DiagnosisScreen';
import { CodexScreen } from '@/screens/codex/CodexScreen';
import { TrainRoute } from '@/screens/train/TrainRoute';
import { TrainScreen } from '@/screens/train/TrainScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { Stats } from '@/screens/Stats';
import { Entrance } from '@/screens/title/Entrance';
import { TitleRoute } from '@/screens/title/TitleScreen';
import { useBgmSync } from '@/sound/useBgmSync';
import { StoreProvider } from './StoreContext';

/** GitHub Pages で動くよう、URL は `#/...` 形式（ハッシュルーティング）にする */
export function App() {
  useBgmSync();
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Entrance><Home /></Entrance>} />
          <Route path="/stages" element={<StageSelectRoute />} />
          <Route path="/stage/:id" element={<StageRoute />} />
          <Route path="/diagnosis" element={<DiagnosisScreen />} />
          <Route path="/codex" element={<CodexScreen />} />
          <Route path="/train" element={<TrainScreen />} />
          <Route path="/train/:kind" element={<TrainRoute />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/title" element={<TitleRoute />} />
          <Route path="/play" element={<PlayRoute />} />
          <Route path="/boss/:id" element={<BossRoute />} />
          <Route path="/daily" element={<DailyRoute />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<Entrance><Home /></Entrance>} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
