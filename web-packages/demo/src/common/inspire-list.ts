import inspireList from '../assets/inspire-list';

export class InspireList {
  currentInspire = inspireList['ribbons'].url;

  private readonly startEle = document.getElementById('J-start') as HTMLElement;
  private readonly pauseEle = document.getElementById('J-pause') as HTMLElement;
  private readonly loopCheckboxEle = document.getElementById('J-loop');
  private readonly frameworkEle = document.getElementById('J-framework') as HTMLSelectElement;

  constructor () {
    this.initSelectList();
    this.bindEvents();
  }

  handlePause () {
    // OVERRIDE
  }

  handleStart () {
    // OVERRIDE
  }

  handleChange () {
    // OVERRIDE
  }

  getFramework () {
    return this.frameworkEle.value;
  }

  private bindEvents () {
    this.startEle.onclick = () => { this.handleStart(); };
    this.pauseEle.onclick = () => { this.handlePause(); };
    if (this.frameworkEle) {
      this.frameworkEle.onchange = () => { this.handleChange(); };
    }
  }

  private initSelectList () {
    const selectEle = document.getElementById('J-select') as HTMLSelectElement;
    const options: string[] = [];

    Object.entries(inspireList).map(([key, object]) => {
      options.push(
        `<option value="${key}" ${object.name === 'ribbons' ? 'selected' : ''}>
          ${object.name}  ${object.pass ? '✅' : '❌'}
        </option>`
      );
    });
    selectEle.innerHTML = options.join('');
    selectEle.onchange = () => {
      const selected = selectEle.value as keyof typeof inspireList;

      this.currentInspire = inspireList[selected].url;
    };
  }
}
