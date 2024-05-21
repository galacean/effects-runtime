import { isValidFontFamily } from '@galacean/effects';

const { expect } = chai;

describe('isValidFontFamily 判断是否合法字体名称', () => {
  it('合法的字体名称', () => {
    expect(isValidFontFamily('_BDFZ_FZZeBrach-Regular')).eq(true);
    expect(isValidFontFamily('_BDFZ_FZZeBrach88-Regular')).eq(true);
    expect(isValidFontFamily('FZZeBrach')).eq(true);
  });
  it('首字母不能为数字或.', () => {
    expect(isValidFontFamily('200_BDFZ_FZZeBrach-Regular')).eq(false);
    expect(isValidFontFamily('._BDFZ_FZZeBrach-Regular')).eq(false);
    expect(isValidFontFamily('.01_BDFZ_FZZeBrach-Regular')).eq(false);
    expect(isValidFontFamily('.')).eq(false);
    expect(isValidFontFamily('01')).eq(false);
  });
  it('不能包含特殊字符', () => {
    expect(isValidFontFamily('BDFZ_FZZeB@rach-Regular')).eq(false);
    expect(isValidFontFamily('BDFZ_FZZeB??rach-Regular')).eq(false);
    expect(isValidFontFamily('BDFZ_FZZeB.rach-Regular')).eq(false);
    expect(isValidFontFamily('_BD!FZ_FZZeBrach-Regular')).eq(false);
    expect(isValidFontFamily('_BD::FZ_FZZeBrach-Regular')).eq(false);
    expect(isValidFontFamily('_BD<01>_FZZeBrach-Regular')).eq(false);
    expect(isValidFontFamily('1 ?2@3')).eq(false);
    expect(isValidFontFamily('1?2@3')).eq(false);
    expect(isValidFontFamily('r1<23')).eq(false);
    expect(isValidFontFamily('x1|2|3')).eq(false);
    expect(isValidFontFamily('??qg?e_ewe')).eq(false);
    expect(isValidFontFamily('qge_ew\'e')).eq(false);
    expect(isValidFontFamily('qge_e$we')).eq(false);
    expect(isValidFontFamily('2.00;BDFZ;FZZeBrach-Regular;2000; FLVI-612')).eq(false);
    expect(isValidFontFamily('2.00;BDFZ;FZZeBrach-Regular;2000;FL720')).eq(false);
  });
});
