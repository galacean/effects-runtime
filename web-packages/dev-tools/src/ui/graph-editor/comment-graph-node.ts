import { math } from '@galacean/effects';
import { GraphNode } from './graph-model';
import { GraphRect } from './graph-rect';

export class CommentGraphNode extends GraphNode {
  static readonly s_minBoxDimensions = 80;
  m_commentBoxSize = new math.Vector2(320, 200);
  color = new math.Color(.3, .3, .3, 1);
  override GetTypeName (): string { return 'Comment'; }
  override IsRenameable (): boolean { return true; }
  getCommentBoxColor (): math.Color { return this.color; }
  getCommentBoxSize (): math.Vector2 { return this.m_commentBoxSize; }
  override GetSize (): math.Vector2 { return this.m_commentBoxSize; }
  override GetRect (): GraphRect { return new GraphRect(this.GetPosition(), new math.Vector2(this.m_canvasPosition.x + this.m_commentBoxSize.x, this.m_canvasPosition.y + this.m_commentBoxSize.y)); }
}
