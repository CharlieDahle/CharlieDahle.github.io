// Category colors. The server stores the name; the page draws the color.
// Each family has a light, regular and dark shade. The picker shows one family
// per column, light at the top.
export const FAMILIES = [
  [["red-light", "#f28b8e"], ["red", "#e5484d"], ["red-dark", "#b02a30"]],
  [["rose-light", "#e38da3"], ["rose", "#c94f6d"], ["rose-dark", "#962f4a"]],
  [["pink-light", "#f09bc2"], ["pink", "#e45c9c"], ["magenta", "#b0479e"]],
  [["purple-light", "#b9a3ea"], ["purple", "#8e6bd8"], ["purple-dark", "#6446b0"]],
  [["indigo-light", "#9a9aec"], ["indigo", "#5b5bd6"], ["indigo-dark", "#3d3da6"]],
  [["blue-light", "#84aef0"], ["blue", "#3e7be0"], ["navy", "#2f4a8a"]],
  [["cyan-light", "#7ccbec"], ["cyan", "#2fa8d8"], ["cyan-dark", "#1d7aa1"]],
  [["teal-light", "#5fc9c9"], ["teal", "#1aa3a3"], ["teal-dark", "#127272"]],
  [["green-light", "#6cc79a"], ["green", "#2f9e6b"], ["green-dark", "#1f6e4a"]],
  [["lime-light", "#b4d65a"], ["lime", "#7fae1b"], ["lime-dark", "#5a7d12"]],
  [["yellow-light", "#ecd06a"], ["yellow", "#d9a91a"], ["olive", "#8a8a2e"]],
  [["orange-light", "#f7b26a"], ["orange", "#f0901e"], ["brown", "#a0724b"]],
  [["slate-light", "#8795a6"], ["slate", "#5e6b7a"], ["slate-dark", "#3b4450"]],
];

export const PALETTE = Object.fromEntries(FAMILIES.flat());

// Expenses with no category.
export const GENERAL_COLOR = "#a1a1a6";

export const colorOf = (category) => (category ? PALETTE[category.color] || GENERAL_COLOR : GENERAL_COLOR);
