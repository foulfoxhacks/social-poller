// Opt-in embed theme. Never interpolate caller-supplied CSS, colors or URLs.
export const creatorThemeCss = `
.theme-creator{color:#fff7e7;background:#050302;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}
.theme-creator a,.theme-creator .eyebrow{color:#ffc857}
.theme-creator :focus-visible{outline:3px solid #ffc857;outline-offset:4px}
.theme-creator .profile,.theme-creator .notice,.theme-creator .doc{border:1px solid #7d592c;border-radius:0;background:linear-gradient(150deg,#1f1109,#080402)}
.theme-creator .status,.theme-creator .view-options a{border-color:#7d592c;border-radius:0}
.theme-creator .metric,.theme-creator .series{background:#21150b;border-radius:0;border:1px solid #644626}
.theme-creator .metric dt,.theme-creator .metric p,.theme-creator .muted{color:#d8c6b0}
.theme-creator .trend,.theme-creator .motion-display,.theme-creator th,.theme-creator td,.theme-creator footer{border-color:#7d592c}
.theme-creator button{border-color:#ffc857;border-radius:0;background:#ffc857;color:#1d1005}
.theme-creator .series svg text{fill:#d8c6b0}.theme-creator .series svg .axis{stroke:#ba905e}
.theme-creator .series polyline{stroke:#ffc857}.theme-creator .series circle{fill:#fff0d8;stroke:#b87333}
`;
