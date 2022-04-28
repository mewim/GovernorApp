import randomcolor from "randomcolor";

class TableColorManger {
  constructor() {
    this.colors = {};
  }
  getColor(tableId) {
    if (this.colors[tableId]) {
      return this.colors[tableId];
    }
    const color = randomcolor();
    this.colors[tableId] = color;
    return color;
  }
}

const instance = new TableColorManger();
export default instance;
