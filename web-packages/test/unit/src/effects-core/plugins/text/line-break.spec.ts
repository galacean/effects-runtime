import { breakOpportunityAfter, isBreakChar, isCJKLike } from '@galacean/effects';

const { expect } = chai;

// 用码点构造控制字符，避免源码字面反斜杠转义
const TAB = String.fromCharCode(9);
const NBSP = String.fromCharCode(160);
const NEWLINE = String.fromCharCode(10);
// CJK 扩展 B 首字 U+20000（代理对）
const CJK_EXT_B = String.fromCodePoint(0x20000);
const EMOJI = String.fromCodePoint(0x1F600);

describe('core/plugins/text/line-break', () => {
  describe('isBreakChar', () => {
    it('空格 / 制表符 / NBSP 视为断点字符', () => {
      expect(isBreakChar(' ')).to.be.true;
      expect(isBreakChar(TAB)).to.be.true;
      expect(isBreakChar(NBSP)).to.be.true;
    });

    it('其他字符不是断点字符', () => {
      expect(isBreakChar('a')).to.be.false;
      expect(isBreakChar('您')).to.be.false;
      expect(isBreakChar('0')).to.be.false;
      expect(isBreakChar(NEWLINE)).to.be.false;
    });
  });

  describe('isCJKLike', () => {
    it('中文 / 假名 / 韩文音节视为 CJK', () => {
      expect(isCJKLike('您')).to.be.true;
      expect(isCJKLike('あ')).to.be.true; // 平假名
      expect(isCJKLike('ア')).to.be.true; // 片假名
      expect(isCJKLike('가')).to.be.true; // 韩文音节
    });

    it('CJK 扩展 B 代理对视为 CJK', () => {
      expect(isCJKLike(CJK_EXT_B)).to.be.true;
    });

    it('拉丁 / 数字 / emoji / 标点不是 CJK', () => {
      expect(isCJKLike('a')).to.be.false;
      expect(isCJKLike('0')).to.be.false;
      expect(isCJKLike(EMOJI)).to.be.false;
      expect(isCJKLike('。')).to.be.false; // CJK 标点 U+3002 不纳入
      expect(isCJKLike(' ')).to.be.false;
    });
  });

  describe('breakOpportunityAfter', () => {
    it('prev 是空格类 → swallow（断行时吞掉 prev）', () => {
      expect(breakOpportunityAfter(' ')).to.equal('swallow');
      expect(breakOpportunityAfter(TAB)).to.equal('swallow');
      expect(breakOpportunityAfter(NBSP)).to.equal('swallow');
    });

    it('prev 是 CJK → keep（prev 留本行末，下行从其后起）', () => {
      expect(breakOpportunityAfter('您')).to.equal('keep');
      expect(breakOpportunityAfter('あ')).to.equal('keep');
      expect(breakOpportunityAfter('가')).to.equal('keep');
      expect(breakOpportunityAfter(CJK_EXT_B)).to.equal('keep');
    });

    it('prev 是拉丁 / 数字 / emoji / 标点 → false（不可断）', () => {
      expect(breakOpportunityAfter('a')).to.equal(false);
      expect(breakOpportunityAfter('0')).to.equal(false);
      expect(breakOpportunityAfter('.')).to.equal(false);
      expect(breakOpportunityAfter(EMOJI)).to.equal(false);
      expect(breakOpportunityAfter('。')).to.equal(false);
    });

    it('只看 prev，西文→CJK 的断点在 CJK 之后而非之前', () => {
      // prev='0'（西文）即使后面将出现 CJK，也不在此处设断点
      expect(breakOpportunityAfter('0')).to.equal(false);
      // prev=CJK 时设 keep 断点，CJK 留本行末
      expect(breakOpportunityAfter('您')).to.equal('keep');
    });
  });
});
