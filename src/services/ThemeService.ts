import githubCss from 'highlight.js/styles/github.css';
import monokaiCss from 'highlight.js/styles/monokai.css';
import draculaCss from 'highlight.js/styles/base16/dracula.css';
import solarizedLightCss from 'highlight.js/styles/base16/solarized-light.css';
import atomOneDarkCss from 'highlight.js/styles/atom-one-dark.css';

const THEMES: Record<string, string> = {
    'github': githubCss,
    'monokai': monokaiCss,
    'dracula': draculaCss,
    'solarized-light': solarizedLightCss,
    'atom-one-dark': atomOneDarkCss,
};

export function getHighlightThemeCss(themeName: string): string {
    return THEMES[themeName.toLowerCase()] ?? THEMES['github'];
}
