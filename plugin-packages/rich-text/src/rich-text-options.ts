import type { spec } from '@galacean/effects';
// import { TextLayout, TextStyle } from '@galacean/effects';
import type { RichTextComponent } from './rich-text-component';

export class RichTextOptions {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: spec.TextWeight;
  fontStyle: spec.FontStyle;
  fontColor: spec.vec4;
  constructor (richTextComponent: RichTextComponent) {
    // const {layout, style} = richTextComponent;
    // const { text, fontSize, fontFamily, fontWeight, fontStyle, fontColor } = ;

  }

}
