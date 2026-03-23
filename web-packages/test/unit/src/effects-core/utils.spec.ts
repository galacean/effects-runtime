import { isSafeFontFamily } from '@galacean/effects';

const { expect } = chai;

describe('core/utils/isSafeFontFamily 判断是否合法字体名称', () => {
  it('合法的字体名称', () => {
    expect(isSafeFontFamily('_BDFZ_FZZeBrach-Regular')).eq(true);
    expect(isSafeFontFamily('_BDFZ_FZZeBrach88-Regular')).eq(true);
    expect(isSafeFontFamily('FZZeBrach')).eq(true);
  });
  it('首字母不能为数字或.', () => {
    expect(isSafeFontFamily('200_BDFZ_FZZeBrach-Regular')).eq(false);
    expect(isSafeFontFamily('._BDFZ_FZZeBrach-Regular')).eq(false);
    expect(isSafeFontFamily('.01_BDFZ_FZZeBrach-Regular')).eq(false);
    expect(isSafeFontFamily('.')).eq(false);
    expect(isSafeFontFamily('01')).eq(false);
  });
  it('不能包含特殊字符', () => {
    expect(isSafeFontFamily('BDFZ_FZZeB@rach-Regular')).eq(false);
    expect(isSafeFontFamily('BDFZ_FZZeB??rach-Regular')).eq(false);
    expect(isSafeFontFamily('BDFZ_FZZeB.rach-Regular')).eq(false);
    expect(isSafeFontFamily('_BD!FZ_FZZeBrach-Regular')).eq(false);
    expect(isSafeFontFamily('_BD::FZ_FZZeBrach-Regular')).eq(false);
    expect(isSafeFontFamily('_BD<01>_FZZeBrach-Regular')).eq(false);
    expect(isSafeFontFamily('1 ?2@3')).eq(false);
    expect(isSafeFontFamily('1?2@3')).eq(false);
    expect(isSafeFontFamily('r1<23')).eq(false);
    expect(isSafeFontFamily('x1|2|3')).eq(false);
    expect(isSafeFontFamily('??qg?e_ewe')).eq(false);
    expect(isSafeFontFamily('qge_ew\'e')).eq(false);
    expect(isSafeFontFamily('qge_e$we')).eq(false);
    expect(isSafeFontFamily('2.00;BDFZ;FZZeBrach-Regular;2000; FLVI-612')).eq(false);
    expect(isSafeFontFamily('2.00;BDFZ;FZZeBrach-Regular;2000;FL720')).eq(false);
  });
});
