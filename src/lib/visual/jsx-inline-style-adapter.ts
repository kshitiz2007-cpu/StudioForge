import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { generate } from "@babel/generator";

type JsxEdit = {
  tagName?: string;
  selector: string;
  classNames?: string[];
  property: string;
  value: string;
};

const CSS_TO_REACT: Record<string, string> = {
  "background-color": "backgroundColor",
  "background-image": "backgroundImage",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "line-height": "lineHeight",
  "letter-spacing": "letterSpacing",
  "text-align": "textAlign",
  "min-width": "minWidth",
  "max-width": "maxWidth",
  "min-height": "minHeight",
  "max-height": "maxHeight",
  "margin-top": "marginTop",
  "margin-right": "marginRight",
  "margin-bottom": "marginBottom",
  "margin-left": "marginLeft",
  "padding-top": "paddingTop",
  "padding-right": "paddingRight",
  "padding-bottom": "paddingBottom",
  "padding-left": "paddingLeft",
  "row-gap": "rowGap",
  "column-gap": "columnGap",
  "flex-direction": "flexDirection",
  "flex-wrap": "flexWrap",
  "justify-content": "justifyContent",
  "align-items": "alignItems",
  "align-content": "alignContent",
  "border-width": "borderWidth",
  "border-style": "borderStyle",
  "border-color": "borderColor",
  "border-radius": "borderRadius",
  "box-shadow": "boxShadow",
};

function staticAttributeValue(attribute: any): string | null {
  if (!attribute || attribute.type !== "JSXAttribute" || !attribute.value) return null;
  if (attribute.value.type === "StringLiteral") return attribute.value.value;
  if (attribute.value.type === "JSXExpressionContainer" && attribute.value.expression?.type === "StringLiteral") {
    return attribute.value.expression.value;
  }
  return null;
}

export function updateJsxInlineStyle(source: string, filename: string, edit: JsxEdit) {
  const extension = filename.toLowerCase().split(".").pop();
  const plugins: any[] = ["jsx", "decorators-legacy", "classProperties", "dynamicImport"];
  if (extension === "tsx" || extension === "ts") plugins.push("typescript");
  let ast: any;
  try {
    ast = parse(source, { sourceType: "unambiguous", plugins, errorRecovery: false });
  } catch {
    return null;
  }

  const classNames = (edit.classNames ?? []).filter((name) => /^[\w-]{1,100}$/.test(name));
  const id = edit.selector.startsWith("#") && /^#[\w-]+$/.test(edit.selector) ? edit.selector.slice(1) : null;
  const reactProperty = CSS_TO_REACT[edit.property] ?? edit.property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  const matches: any[] = [];

  traverse(ast, {
    JSXOpeningElement(path: any) {
      const node = path.node;
      if (edit.tagName && node.name?.type === "JSXIdentifier" && node.name.name.toLowerCase() !== edit.tagName.toLowerCase()) return;
      const attributes = node.attributes.filter((attribute: any) => attribute.type === "JSXAttribute");
      const classAttribute = attributes.find((attribute: any) => attribute.name?.name === "className" || attribute.name?.name === "class");
      const idAttribute = attributes.find((attribute: any) => attribute.name?.name === "id");
      const actualClasses = (staticAttributeValue(classAttribute) ?? "").split(/\s+/).filter(Boolean);
      const actualId = staticAttributeValue(idAttribute);
      const classMatch = classNames.length > 0 && classNames.some((name) => actualClasses.includes(name));
      const idMatch = Boolean(id && actualId === id);
      if (classMatch || idMatch) matches.push(node);
    },
  });

  if (matches.length !== 1) return null;
  const node = matches[0];
  const styleAttribute = node.attributes.find((attribute: any) => attribute.type === "JSXAttribute" && attribute.name?.name === "style");
  const styleObject = styleAttribute?.value?.type === "JSXExpressionContainer" ? styleAttribute.value.expression : null;
  if (styleAttribute && styleObject?.type !== "ObjectExpression") return null;

  if (styleObject) {
    if (styleObject.properties.some((property: any) => property.type !== "ObjectProperty" || property.computed || property.method || property.shorthand)) return null;
    const existing = styleObject.properties.find((property: any) => {
      const key = property.key?.name ?? property.key?.value;
      return key === reactProperty;
    });
    if (existing) {
      existing.value = { type: "StringLiteral", value: edit.value, extra: { raw: JSON.stringify(edit.value), rawValue: edit.value } };
    } else {
      styleObject.properties.push({
        type: "ObjectProperty",
        key: { type: "Identifier", name: reactProperty },
        value: { type: "StringLiteral", value: edit.value, extra: { raw: JSON.stringify(edit.value), rawValue: edit.value } },
        computed: false,
        shorthand: false,
      });
    }
    const generated = generate(styleObject, { concise: true, jsescOption: { minimal: false } }).code;
    const start = styleObject.start;
    const end = styleObject.end;
    if (typeof start !== "number" || typeof end !== "number") return null;
    return { content: source.slice(0, start) + generated + source.slice(end), matchedSelector: edit.selector, mode: "updated-inline-style" as const };
  }

  const openingEnd = source.lastIndexOf(">", node.end - 1);
  if (openingEnd < 0) return null;
  const insertAt = source[openingEnd - 1] === "/" ? openingEnd - 1 : openingEnd;
  const attributeText = ` style={{ ${reactProperty}: ${JSON.stringify(edit.value)} }}`;
  return {
    content: source.slice(0, insertAt) + attributeText + source.slice(insertAt),
    matchedSelector: edit.selector,
    mode: "added-inline-style" as const,
  };
}
