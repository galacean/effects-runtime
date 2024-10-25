import type { spec, TextStyle } from '@galacean/effects';

export class RichTextOptions {
  fontFamily: string;
  fontWeight: spec.TextWeight;
  fontStyle: spec.FontStyle;
  fontColor: spec.vec4;
  textStyle: TextStyle;
  isNewLine: boolean = false;
  constructor (public text: string, public fontSize: number = 40) {
  }

  clone (): RichTextOptions {
    const newOptions = new RichTextOptions(this.text, this.fontSize);

    newOptions.fontFamily = this.fontFamily;
    newOptions.fontWeight = this.fontWeight;
    newOptions.fontStyle = this.fontStyle;
    newOptions.fontColor = this.fontColor;

    return newOptions;
  }

}
