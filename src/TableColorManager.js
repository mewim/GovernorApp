import randomcolor from "randomcolor";

class TableColorManger {
  constructor() {
    this.colorPalette = [
      "#4e79a7",
      "#f28e2c",
      "#e15759",
      "#76b7b2",
      "#59a14f",
      "#edc949",
      "#af7aa1",
      "#ff9da7",
      "#9c755f",
    ];
    this.nullColor = "#d9d9d9";
    this.colors = {};
  }
  getColor(tableId) {
    if (!tableId) {
      return this.nullColor;
    }
    if (this.colors[tableId]) {
      return this.colors[tableId];
    }
    let color = this.colorPalette.pop();
    if (!color) {
      color = randomcolor();
    }
    this.colors[tableId] = color;
    return color;
  }
  addColor(tableId, color) {
    this.colors[tableId] = color;
    const colorPaletteIndex = this.colorPalette.indexOf(color);
    if (colorPaletteIndex === -1) {
      return;
    }
    this.colorPalette.splice(colorPaletteIndex, 1);
  }
}

const instance = new TableColorManger();
export default instance;
