export class DBML {
  private built = '';

  public insert(str: string) {
    this.built += str;
    return this;
  }

  public concatAll(strs: string[]) {
    for (let i = 0; i < strs.length; i++) {
      this.insert(strs[i]);
      this.newLine(2);
    }
    return this;
  }

  /**
   * Escapes characters that aren't allowed in DBML surrounding the input with double quotes
   */
  public escapeSpaces(str: string) {
    this.built += str.includes(' ') ? `"${str}"` : str;
    return this;
  }

  public escapeType(str: string) {
    this.built += str.includes(' ') || str.includes(')[') ? `"${str}"` : str;
    return this;
  }

  public newLine(newLines: number = 1) {
    this.built += '\n'.repeat(newLines);
    return this;
  }

  public tab(tabs: number = 1) {
    this.built += ' '.repeat(tabs * 2);
    return this;
  }

  public build() {
    return this.built.trimEnd();
  }
}
