import type { Engine } from '@galacean/effects';
import { HBoxContainer } from '@galacean/effects-plugin-gui';
import { EditorIconButton } from '../icons/control-icons';
import type { EditorIcon } from '../icons/control-icons';
import { editorColors } from '../theme/control-theme';
import { append } from './layout';
import { setTooltip } from './tooltip';

export interface TransportControlActions {
  playing: () => boolean,
  play: () => void,
  start?: () => void,
  previousKey?: () => void,
  previousFrame?: () => void,
  stop?: () => void,
  nextFrame?: () => void,
  nextKey?: () => void,
  end?: () => void,
  looping?: () => boolean,
  toggleLoop?: () => void,
}

export class EditorTransportControl extends HBoxContainer {
  private readonly play: EditorIconButton;
  private readonly loop?: EditorIconButton;
  constructor (engine: Engine, private readonly actions: TransportControlActions) {
    super(engine); this.setThemeConstantOverride('separation', 4);
    this.addButton('first', 'Jump to Start', actions.start);
    this.addButton('previous', 'Previous Key (,)', actions.previousKey);
    this.addButton('back', 'Previous Frame', actions.previousFrame);
    this.play = this.addButton('play', 'Play / Pause', actions.play)!;
    this.addButton('stop', 'Stop', actions.stop);
    this.addButton('forward', 'Next Frame', actions.nextFrame);
    this.addButton('next', 'Next Key (.)', actions.nextKey);
    this.addButton('last', 'Jump to End', actions.end);
    if (actions.looping && actions.toggleLoop) {
      this.loop = this.addButton('loop', 'Toggle Loop Playback', actions.toggleLoop);
    }
  }
  private addButton (icon: EditorIcon, tooltip: string, action?: () => void): EditorIconButton | undefined {
    if (!action) { return; }
    const button = append(this, new EditorIconButton(this.engine, icon));

    button.themeTypeVariation = 'EditorTransportButton'; button.iconSize = 20; button.setCustomMinimumSize(24, 24); button.on('pressed', action); setTooltip(button, tooltip);

    return button;
  }
  override update (dt: number): void {
    this.play.iconName = this.actions.playing() ? 'pause' : 'play';
    if (this.loop) { this.loop.iconTint = this.actions.looping?.() ? editorColors.foreground : editorColors.muted; }
    super.update(dt);
  }
}
