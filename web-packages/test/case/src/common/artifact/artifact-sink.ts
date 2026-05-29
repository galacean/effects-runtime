import type { FrameCompareScene } from '../../framework/types/profile';
import type { TestPlayer } from '../player/test-player';
import { getCurrnetTimeStr } from '../utilities';

// 单次运行的 runId,整批落盘共用,作为产物根目录名。
const runId = getCurrnetTimeStr();

const ARTIFACT_ENDPOINT = '/__test-artifact';

// 落盘开关纯由 CLI 控制:无头 runner 通过 URL query dumpArtifacts=1 传入。
// 未指定(手动 `pnpm test`)或显式 0/false 时关闭,默认不落盘。
export function isDumpArtifactsEnabled (): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const value = new URLSearchParams(window.location.search).get('dumpArtifacts');

  return value !== null && value !== '0' && value !== 'false';
}

export type ArtifactSinkOptions = {
  suite: string,
  framework: string,
  scene: FrameCompareScene,
  threshold: number,
  pixelDiffThreshold: number,
  canvas: {
    width: number,
    height: number,
  },
  player: TestPlayer,
};

type FrameRecord = {
  time: number,
  diffRatio: number,
  summary: string,
  compare: string,
};

// 去除文件系统/路径敏感字符,保留可读性(含中文)。
function sanitizeSegment (value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_');
}

export class ArtifactSink {
  private readonly sceneDir: string;
  private readonly frames: FrameRecord[] = [];
  private sceneJSONWritten = false;

  constructor (private readonly options: ArtifactSinkOptions) {
    const { suite, framework, scene } = options;
    const suiteDir = `${sanitizeSegment(suite)}_${sanitizeSegment(framework)}`;
    const sceneDirName = `${sanitizeSegment(scene.name)}_${sanitizeSegment(scene.id)}`;

    this.sceneDir = `${runId}/${suiteDir}/${sceneDirName}`;
  }

  // 落盘失败仅告警,绝不让测试因为落盘而失败。
  private async writeFile (relPath: string, data: string, encoding: 'base64' | 'utf8') {
    try {
      await fetch(ARTIFACT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `${this.sceneDir}/${relPath}`, data, encoding }),
      });
    } catch (e) {
      console.warn('[Test] Artifact write failed:', relPath, e);
    }
  }

  // 惰性写场景 JSON:仅在出现首个超阈值帧时写一次,无差异的用例不产生任何文件。
  private async ensureSceneJSON () {
    if (this.sceneJSONWritten) {
      return;
    }
    this.sceneJSONWritten = true;

    try {
      const { player, scene } = this.options;
      const loaded = player.getLoadedSceneJSON();
      let json: string;

      if (loaded && typeof loaded === 'object') {
        // 3D 转换后 / setupPlayers 自定义,已是对象。
        json = JSON.stringify(loaded);
      } else if (scene.url) {
        // 2D 字符串 URL,拉取原始 JSON 文本。
        json = await (await fetch(scene.url)).text();
      } else {
        return;
      }

      await this.writeFile('scene.json', json, 'utf8');
    } catch (e) {
      console.warn('[Test] Save scene JSON failed:', e);
    }
  }

  async saveCompareFrame (time: number, compareDataURL: string, info: { diffRatio: number, summary: string }) {
    if (!compareDataURL) {
      return;
    }

    await this.ensureSceneJSON();

    const base64 = compareDataURL.replace(/^data:image\/\w+;base64,/, '');
    const fileName = `${sanitizeSegment(String(time))}_compare.png`;

    await this.writeFile(fileName, base64, 'base64');
    this.frames.push({
      time,
      diffRatio: info.diffRatio,
      summary: info.summary,
      compare: fileName,
    });
  }

  async flushMeta () {
    // 没有任何超阈值帧 → 不写 meta.json,该用例完全不落盘。
    if (this.frames.length === 0) {
      return;
    }

    const { suite, framework, scene, threshold, pixelDiffThreshold, canvas } = this.options;
    const meta = {
      runId,
      suite,
      framework,
      scene: {
        id: scene.id,
        name: scene.name,
        url: scene.url,
      },
      threshold,
      pixelDiffThreshold,
      canvas,
      frames: this.frames,
    };

    await this.writeFile('meta.json', JSON.stringify(meta, null, 2), 'utf8');
  }
}
