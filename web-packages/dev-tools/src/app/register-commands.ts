import { projectWorkspace } from '../features/projects/project-workspace';
import { projectBrowser } from '../features/projects/ui/project-browser-dialog';
import { sceneWorkspace } from '../features/scene/scene-workspace';
import { editorCommands } from '../framework/commands/editor-commands';

export function registerEditorCommands (): void {
  const idle = () => !sceneWorkspace.busy && !projectWorkspace.busy;
  const hasScene = () => idle() && !!sceneWorkspace.current;

  editorCommands.onError = error => sceneWorkspace.report(error);
  editorCommands.register('document.undo', {
    label: () => 'Undo' + (sceneWorkspace.current?.canUndo ? ' ' + sceneWorkspace.current.undoLabel : ''), shortcut: 'Ctrl+Z',
    execute: () => sceneWorkspace.undo(), canExecute: () => idle() && !!sceneWorkspace.current?.canUndo,
  });
  editorCommands.register('document.redo', {
    label: () => 'Redo' + (sceneWorkspace.current?.canRedo ? ' ' + sceneWorkspace.current.redoLabel : ''), shortcut: 'Ctrl+Shift+Z',
    execute: () => sceneWorkspace.redo(), canExecute: () => idle() && !!sceneWorkspace.current?.canRedo,
  });
  editorCommands.register('scene.new', { label: 'New Scene', shortcut: 'Ctrl+N', execute: () => sceneWorkspace.newScene(), canExecute: idle });
  editorCommands.register('scene.open', { label: 'Open Scene...', shortcut: 'Ctrl+O', execute: () => sceneWorkspace.showOpen(), canExecute: idle });
  editorCommands.register('scene.save', { label: 'Save Current Scene', shortcut: 'Ctrl+S', execute: () => sceneWorkspace.save(), canExecute: hasScene });
  editorCommands.register('scene.save-as', { label: 'Save Current Scene As...', shortcut: 'Ctrl+Alt+S', execute: () => sceneWorkspace.showSaveAs(), canExecute: hasScene });
  editorCommands.register('scene.save-all', { label: 'Save All', shortcut: 'Ctrl+Shift+S', execute: () => sceneWorkspace.saveAll(), canExecute: hasScene });
  editorCommands.register('project.new', { label: 'New Project...', execute: () => projectBrowser.show('new'), canExecute: () => idle() && projectWorkspace.ready });
  editorCommands.register('project.open', { label: 'Open Project...', execute: () => projectBrowser.show(), canExecute: () => idle() && projectWorkspace.ready });
  editorCommands.register('project.import', { label: 'Import Project...', execute: () => projectWorkspace.chooseImport(), canExecute: () => idle() && projectWorkspace.ready });
  editorCommands.register('project.export', { label: 'Export Project...', execute: () => projectWorkspace.export(), canExecute: () => idle() && !!projectWorkspace.current });
  editorCommands.register('project.settings', { label: 'Project Settings...', execute: () => projectBrowser.showSettings(), canExecute: () => idle() && projectWorkspace.ready });
}
