/**
 * One-shot local corpus writer — no network.
 * Run: pnpm --filter @cocktail/db exec tsx src/seed/writeIbaRecipesJson.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Line = {
  sourceName: string;
  amountMl: number | null;
  role: "required" | "optional" | "garnish" | "either";
  eitherGroupId?: string;
  ingredientId?: string;
};

type Recipe = {
  id: string;
  importKind: "new_recipe" | "new_version";
  targetRecipeId?: string;
  nameZh: string;
  nameEn: string;
  ibaCategory: string;
  sourceName: string;
  sourceRevision: string;
  familyId: string;
  flavorTagIds: string[];
  glassware: string;
  garnish: string;
  steps: string[];
  ingredients: Line[];
  editorRecommended?: boolean;
  recommendationOrder?: number;
};

const R = (
  id: string,
  nameEn: string,
  nameZh: string,
  cat: string,
  familyId: string,
  flavors: string[],
  glassware: string,
  garnish: string,
  steps: string[],
  ingredients: Line[],
  extra: Partial<Recipe> = {},
): Recipe => ({
  id,
  importKind: "new_recipe",
  nameZh,
  nameEn,
  ibaCategory: cat,
  sourceName: "IBA Official Cocktails (local corpus snapshot)",
  sourceRevision: "2020-2024",
  familyId,
  flavorTagIds: flavors,
  glassware,
  garnish,
  steps,
  ingredients,
  ...extra,
});

const U = "The Unforgettables";
const C = "Contemporary Classics";
const N = "New Era Drinks";

const recipes: Recipe[] = [
  R("iba-negroni", "Negroni", "内格罗尼", U, "duo_trio", ["bitter", "sweet"], "Old Fashioned", "Orange slice", ["Stir with ice", "Strain into glass", "Garnish"], [
    { sourceName: "Gin", amountMl: 30, role: "required" },
    { sourceName: "Campari", amountMl: 30, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 30, role: "required" },
  ], { editorRecommended: true, recommendationOrder: 1 }),
  R("iba-old-fashioned", "Old Fashioned", "古典鸡尾酒", U, "old_fashioned", ["sweet", "bitter"], "Old Fashioned", "Orange twist", ["Muddle sugar with bitters", "Add whiskey and ice", "Stir", "Garnish"], [
    { sourceName: "Whiskey", amountMl: 45, role: "either", eitherGroupId: "whiskey_style" },
    { sourceName: "Bourbon", amountMl: 45, role: "either", eitherGroupId: "whiskey_style" },
    { sourceName: "Rye Whiskey", amountMl: 45, role: "either", eitherGroupId: "whiskey_style" },
    { sourceName: "Sugar", amountMl: null, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
    { sourceName: "Water", amountMl: 5, role: "optional" },
    { sourceName: "Orange Peel", amountMl: null, role: "garnish" },
  ], { editorRecommended: true, recommendationOrder: 2 }),
  R("iba-dry-martini", "Dry Martini", "干马天尼", U, "martini_manhattan", ["dry", "herbal"], "Cocktail glass", "Olive or lemon twist", ["Stir with ice", "Strain", "Garnish"], [
    { sourceName: "Gin", amountMl: 60, role: "required" },
    { sourceName: "Dry Vermouth", amountMl: 10, role: "required" },
    { sourceName: "Olive", amountMl: null, role: "garnish" },
  ], { editorRecommended: true, recommendationOrder: 3 }),
  R("iba-manhattan", "Manhattan", "曼哈顿", U, "martini_manhattan", ["sweet", "bitter"], "Cocktail glass", "Cherry", ["Stir with ice", "Strain", "Garnish"], [
    { sourceName: "Rye Whiskey", amountMl: 50, role: "either", eitherGroupId: "manhattan_whiskey" },
    { sourceName: "Bourbon", amountMl: 50, role: "either", eitherGroupId: "manhattan_whiskey" },
    { sourceName: "Sweet Red Vermouth", amountMl: 20, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
    { sourceName: "Cherry", amountMl: null, role: "garnish" },
  ]),
  R("iba-daiquiri", "Daiquiri", "戴克瑞", U, "sour", ["sour", "fruity"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "White Rum", amountMl: 60, role: "required" },
    { sourceName: "Lime Juice", amountMl: 20, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 10, role: "required" },
  ]),
  R("iba-whiskey-sour", "Whiskey Sour", "威士忌酸", U, "sour", ["sour", "sweet"], "Old Fashioned", "Cherry and orange", ["Shake with ice", "Strain", "Garnish"], [
    { sourceName: "Bourbon", amountMl: 45, role: "either", eitherGroupId: "ws_whiskey" },
    { sourceName: "Rye Whiskey", amountMl: 45, role: "either", eitherGroupId: "ws_whiskey" },
    { sourceName: "Lemon Juice", amountMl: 25, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 20, role: "required" },
    { sourceName: "Egg White", amountMl: 20, role: "optional" },
  ]),
  R("iba-margarita", "Margarita", "玛格丽特", C, "daisy", ["sour", "fruity"], "Cocktail glass", "Salt rim", ["Shake with ice", "Strain"], [
    { sourceName: "Tequila", amountMl: 50, role: "required" },
    { sourceName: "Triple Sec", amountMl: 20, role: "required" },
    { sourceName: "Lime Juice", amountMl: 15, role: "required" },
    { sourceName: "Salt", amountMl: null, role: "garnish" },
  ]),
  R("iba-moscow-mule", "Moscow Mule", "莫斯科骡子", C, "highball", ["spicy", "sour"], "Mug", "Lime wedge", ["Build over ice", "Stir gently"], [
    { sourceName: "Vodka", amountMl: 45, role: "required" },
    { sourceName: "Lime Juice", amountMl: 10, role: "required" },
    { sourceName: "Ginger Beer", amountMl: 120, role: "required" },
  ]),
  R("iba-mojito", "Mojito", "莫吉托", C, "highball", ["herbal", "sour"], "Highball", "Mint sprig", ["Muddle mint with sugar and lime", "Add rum and ice", "Top with soda", "Garnish"], [
    { sourceName: "White Rum", amountMl: 45, role: "required" },
    { sourceName: "Lime Juice", amountMl: 20, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 20, role: "required" },
    { sourceName: "Mint", amountMl: null, role: "required" },
    { sourceName: "Soda Water", amountMl: 30, role: "required" },
  ]),
  R("iba-americano", "Americano", "美洲诺", U, "highball", ["bitter", "sweet"], "Highball", "Orange slice", ["Build with ice", "Top with soda"], [
    { sourceName: "Campari", amountMl: 30, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 30, role: "required" },
    { sourceName: "Soda Water", amountMl: 30, role: "required" },
  ]),
  R("iba-aviation", "Aviation", "航空", U, "sour", ["floral", "sour"], "Cocktail glass", "Cherry", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 15, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 15, role: "required" },
    { sourceName: "Crème de Violette", amountMl: 5, role: "optional" },
  ]),
  R("iba-between-the-sheets", "Between the Sheets", "床单之间", U, "sour", ["sour", "fruity"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "White Rum", amountMl: 30, role: "required" },
    { sourceName: "Cognac", amountMl: 30, role: "required" },
    { sourceName: "Triple Sec", amountMl: 30, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 20, role: "required" },
  ]),
  R("iba-boulevardier", "Boulevardier", "林荫大道", U, "duo_trio", ["bitter", "sweet"], "Old Fashioned", "Orange twist", ["Stir with ice", "Strain"], [
    { sourceName: "Bourbon", amountMl: 30, role: "either", eitherGroupId: "blvd_whiskey" },
    { sourceName: "Rye Whiskey", amountMl: 30, role: "either", eitherGroupId: "blvd_whiskey" },
    { sourceName: "Campari", amountMl: 30, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 30, role: "required" },
  ]),
  R("iba-casino", "Casino", "赌场", U, "sour", ["sour", "fruity"], "Cocktail glass", "Lemon twist and cherry", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 40, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 10, role: "required" },
    { sourceName: "Orange Bitters", amountMl: 2, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 10, role: "required" },
  ]),
  R("iba-clover-club", "Clover Club", "三叶草俱乐部", U, "sour", ["sour", "fruity"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 15, role: "required" },
    { sourceName: "Raspberry syrup", amountMl: 15, role: "required" },
    { sourceName: "Egg White", amountMl: 20, role: "optional" },
  ]),
  R("iba-gin-fizz", "Gin Fizz", "金菲士", U, "collins_fizz", ["sour", "sweet"], "Highball", "", ["Shake", "Strain into glass", "Top with soda"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 30, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 10, role: "required" },
    { sourceName: "Soda Water", amountMl: 80, role: "required" },
  ]),
  R("iba-john-collins", "John Collins", "约翰柯林斯", U, "collins_fizz", ["sour", "sweet"], "Highball", "Lemon and cherry", ["Build or shake", "Top with soda"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 30, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 15, role: "required" },
    { sourceName: "Soda Water", amountMl: 60, role: "required" },
  ]),
  R("iba-last-word", "Last Word", "遗言", U, "sour", ["herbal", "sour"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 22.5, role: "required" },
    { sourceName: "Green Chartreuse", amountMl: 22.5, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 22.5, role: "required" },
    { sourceName: "Lime Juice", amountMl: 22.5, role: "required" },
  ]),
  R("iba-martinez", "Martinez", "马丁内斯", U, "martini_manhattan", ["sweet", "herbal"], "Cocktail glass", "Lemon twist", ["Stir with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 45, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 7.5, role: "required" },
    { sourceName: "Orange Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-mary-pickford", "Mary Pickford", "玛丽·皮克福德", U, "sour", ["fruity", "sweet"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "White Rum", amountMl: 45, role: "required" },
    { sourceName: "Pineapple Juice", amountMl: 45, role: "required" },
    { sourceName: "Grenadine", amountMl: 7.5, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 7.5, role: "required" },
  ]),
  R("iba-monkey-gland", "Monkey Gland", "猴腺", U, "sour", ["fruity", "herbal"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Orange Juice", amountMl: 45, role: "required" },
    { sourceName: "Absinthe", amountMl: 5, role: "required" },
    { sourceName: "Grenadine", amountMl: 5, role: "required" },
  ]),
  R("iba-paradise", "Paradise", "天堂", U, "sour", ["fruity", "sweet"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 30, role: "required" },
    { sourceName: "Apricot Brandy", amountMl: 20, role: "required" },
    { sourceName: "Orange Juice", amountMl: 15, role: "required" },
  ]),
  R("iba-planters-punch", "Planter's Punch", "种植园宾治", U, "punch_tiki", ["fruity", "sour"], "Highball", "Orange and cherry", ["Shake or build", "Garnish"], [
    { sourceName: "Dark Rum", amountMl: 45, role: "required" },
    { sourceName: "Orange Juice", amountMl: 35, role: "required" },
    { sourceName: "Pineapple Juice", amountMl: 35, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 20, role: "required" },
    { sourceName: "Grenadine", amountMl: 10, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 10, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-porto-flip", "Porto Flip", "波特翻转", U, "flip", ["sweet", "creamy"], "Cocktail glass", "Grated nutmeg", ["Shake with ice", "Strain"], [
    { sourceName: "Brandy", amountMl: 15, role: "required" },
    { sourceName: "Port", amountMl: 45, role: "required" },
    { sourceName: "Egg Yolk", amountMl: 10, role: "required" },
  ]),
  R("iba-ramos-fizz", "Ramos Fizz", "拉莫斯菲士", U, "collins_fizz", ["creamy", "floral"], "Highball", "", ["Dry shake", "Shake with ice", "Strain", "Top with soda"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 15, role: "required" },
    { sourceName: "Lime Juice", amountMl: 15, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 30, role: "required" },
    { sourceName: "Cream", amountMl: 60, role: "required" },
    { sourceName: "Egg White", amountMl: 30, role: "required" },
    { sourceName: "Orange Flower Water", amountMl: 3, role: "required" },
    { sourceName: "Soda Water", amountMl: 20, role: "required" },
  ]),
  R("iba-rusty-nail", "Rusty Nail", "锈钉", U, "duo_trio", ["sweet", "herbal"], "Old Fashioned", "", ["Build over ice", "Stir"], [
    { sourceName: "Scotch Whisky", amountMl: 45, role: "required" },
    { sourceName: "Drambuie", amountMl: 25, role: "required" },
  ]),
  R("iba-sazerac", "Sazerac", "萨泽拉克", U, "old_fashioned", ["herbal", "spicy"], "Old Fashioned", "Lemon peel", ["Rinse glass with absinthe", "Stir whiskey with sugar and bitters", "Strain", "Garnish"], [
    { sourceName: "Cognac", amountMl: 50, role: "either", eitherGroupId: "sazerac_base" },
    { sourceName: "Rye Whiskey", amountMl: 50, role: "either", eitherGroupId: "sazerac_base" },
    { sourceName: "Absinthe", amountMl: 5, role: "required" },
    { sourceName: "Sugar", amountMl: null, role: "required" },
    { sourceName: "Peychaud's Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-sidecar", "Sidecar", "边车", U, "sour", ["sour", "fruity"], "Cocktail glass", "Sugar rim optional", ["Shake with ice", "Strain"], [
    { sourceName: "Cognac", amountMl: 50, role: "required" },
    { sourceName: "Triple Sec", amountMl: 20, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 20, role: "required" },
  ]),
  R("iba-stinger", "Stinger", "毒刺", U, "duo_trio", ["herbal", "sweet"], "Cocktail glass", "", ["Stir with ice", "Strain"], [
    { sourceName: "Cognac", amountMl: 50, role: "required" },
    { sourceName: "Crème de Menthe", amountMl: 20, role: "required" },
  ]),
  R("iba-tuxedo", "Tuxedo", "燕尾服", U, "martini_manhattan", ["dry", "herbal"], "Cocktail glass", "Cherry and lemon twist", ["Stir with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 30, role: "required" },
    { sourceName: "Dry Vermouth", amountMl: 30, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 5, role: "required" },
    { sourceName: "Absinthe", amountMl: 2, role: "required" },
    { sourceName: "Orange Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-white-lady", "White Lady", "白女士", U, "sour", ["sour", "fruity"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 40, role: "required" },
    { sourceName: "Triple Sec", amountMl: 30, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 20, role: "required" },
  ]),
  R("iba-angel-face", "Angel Face", "天使颜", U, "duo_trio", ["fruity", "sweet"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 30, role: "required" },
    { sourceName: "Apricot Brandy", amountMl: 30, role: "required" },
    { sourceName: "Calvados", amountMl: 30, role: "required" },
  ]),
  R("iba-brandy-crusta", "Brandy Crusta", "白兰地克拉斯塔", U, "sour", ["sour", "fruity"], "Wine glass", "Sugar rim, lemon spiral", ["Shake with ice", "Strain"], [
    { sourceName: "Brandy", amountMl: 52.5, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 15, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 7.5, role: "required" },
    { sourceName: "Triple Sec", amountMl: 7.5, role: "optional" },
    { sourceName: "Simple Syrup", amountMl: 5, role: "optional" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-hanky-panky", "Hanky Panky", "汉基潘基", U, "martini_manhattan", ["herbal", "bitter"], "Cocktail glass", "Orange twist", ["Stir with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 45, role: "required" },
    { sourceName: "Fernet Branca", amountMl: 7.5, role: "required" },
  ]),
  R("iba-bloody-mary", "Bloody Mary", "血腥玛丽", C, "highball", ["savory", "spicy"], "Highball", "Celery / lemon", ["Build or roll", "Season to taste"], [
    { sourceName: "Vodka", amountMl: 45, role: "required" },
    { sourceName: "Tomato Juice", amountMl: 90, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 15, role: "required" },
    { sourceName: "Worcestershire Sauce", amountMl: 3, role: "required" },
    { sourceName: "Tabasco", amountMl: 2, role: "optional" },
    { sourceName: "Salt", amountMl: null, role: "optional" },
    { sourceName: "Black Pepper", amountMl: null, role: "optional" },
  ]),
  R("iba-cosmopolitan", "Cosmopolitan", "大都会", C, "sour", ["fruity", "sour"], "Cocktail glass", "Orange twist", ["Shake with ice", "Strain"], [
    { sourceName: "Vodka", amountMl: 40, role: "required" },
    { sourceName: "Triple Sec", amountMl: 15, role: "required" },
    { sourceName: "Lime Juice", amountMl: 7.5, role: "required" },
    { sourceName: "Cranberry Juice", amountMl: 30, role: "required" },
  ]),
  R("iba-cuba-libre", "Cuba Libre", "自由古巴", C, "highball", ["fruity", "sweet"], "Highball", "Lime wedge", ["Build over ice"], [
    { sourceName: "White Rum", amountMl: 50, role: "required" },
    { sourceName: "Cola", amountMl: 120, role: "required" },
    { sourceName: "Lime Juice", amountMl: 10, role: "required" },
  ]),
  R("iba-french-75", "French 75", "法式75", C, "collins_fizz", ["sour", "dry"], "Champagne flute", "", ["Shake spirits with ice", "Strain", "Top with champagne"], [
    { sourceName: "Gin", amountMl: 30, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 15, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 7.5, role: "required" },
    { sourceName: "Champagne", amountMl: 60, role: "required" },
  ]),
  R("iba-harvey-wallbanger", "Harvey Wallbanger", "哈维撞墙", C, "highball", ["fruity", "sweet"], "Highball", "Orange slice", ["Build over ice"], [
    { sourceName: "Vodka", amountMl: 45, role: "required" },
    { sourceName: "Galliano", amountMl: 15, role: "required" },
    { sourceName: "Orange Juice", amountMl: 90, role: "required" },
  ]),
  R("iba-hemingway-special", "Hemingway Special", "海明威特调", C, "sour", ["sour", "fruity"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "White Rum", amountMl: 60, role: "required" },
    { sourceName: "Grapefruit Juice", amountMl: 40, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 15, role: "required" },
    { sourceName: "Lime Juice", amountMl: 15, role: "required" },
  ]),
  R("iba-horses-neck", "Horse's Neck", "马颈", C, "highball", ["spicy", "dry"], "Highball", "Lemon spiral", ["Build over ice"], [
    { sourceName: "Cognac", amountMl: 40, role: "either", eitherGroupId: "horses_base" },
    { sourceName: "Bourbon", amountMl: 40, role: "either", eitherGroupId: "horses_base" },
    { sourceName: "Ginger Beer", amountMl: 120, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "optional" },
  ]),
  R("iba-irish-coffee", "Irish Coffee", "爱尔兰咖啡", C, "other", ["sweet", "smoky"], "Irish coffee glass", "Cream float", ["Add whiskey and sugar to coffee", "Float cream"], [
    { sourceName: "Irish Whiskey", amountMl: 40, role: "required" },
    { sourceName: "Coffee", amountMl: 80, role: "required" },
    { sourceName: "Sugar", amountMl: null, role: "required" },
    { sourceName: "Cream", amountMl: 30, role: "required" },
  ]),
  R("iba-kir", "Kir", "基尔", C, "other", ["fruity", "dry"], "Wine glass", "", ["Add crème de cassis", "Top with white wine"], [
    { sourceName: "Crème de Cassis", amountMl: 10, role: "required" },
    { sourceName: "White Wine", amountMl: 90, role: "required" },
  ]),
  R("iba-long-island", "Long Island Iced Tea", "长岛冰茶", C, "highball", ["sour", "sweet"], "Highball", "Lemon", ["Build over ice", "Top with cola"], [
    { sourceName: "Vodka", amountMl: 15, role: "required" },
    { sourceName: "Tequila", amountMl: 15, role: "required" },
    { sourceName: "White Rum", amountMl: 15, role: "required" },
    { sourceName: "Gin", amountMl: 15, role: "required" },
    { sourceName: "Triple Sec", amountMl: 15, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 25, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 30, role: "required" },
    { sourceName: "Cola", amountMl: 30, role: "required" },
  ]),
  R("iba-mai-tai", "Mai Tai", "迈泰", C, "punch_tiki", ["fruity", "nutty"], "Old Fashioned / Tiki", "Mint and lime", ["Shake with ice", "Garnish"], [
    { sourceName: "White Rum", amountMl: 30, role: "required" },
    { sourceName: "Dark Rum", amountMl: 30, role: "required" },
    { sourceName: "Triple Sec", amountMl: 15, role: "required" },
    { sourceName: "Orgeat", amountMl: 15, role: "required" },
    { sourceName: "Lime Juice", amountMl: 30, role: "required" },
  ]),
  R("iba-mimosa", "Mimosa", "含羞草", C, "other", ["fruity", "dry"], "Flute", "", ["Build in flute"], [
    { sourceName: "Orange Juice", amountMl: 75, role: "required" },
    { sourceName: "Champagne", amountMl: 75, role: "required" },
  ]),
  R("iba-mint-julep", "Mint Julep", "薄荷朱利普", C, "julep_smash", ["herbal", "sweet"], "Julep cup", "Mint", ["Muddle mint with sugar", "Add bourbon and crushed ice"], [
    { sourceName: "Bourbon", amountMl: 60, role: "required" },
    { sourceName: "Mint", amountMl: null, role: "required" },
    { sourceName: "Sugar", amountMl: null, role: "required" },
    { sourceName: "Water", amountMl: 5, role: "optional" },
  ]),
  R("iba-pina-colada", "Piña Colada", "椰林飘香", C, "punch_tiki", ["fruity", "creamy"], "Pocillo / Hurricane", "Pineapple and cherry", ["Blend or shake with ice"], [
    { sourceName: "White Rum", amountMl: 50, role: "required" },
    { sourceName: "Coconut Cream", amountMl: 30, role: "required" },
    { sourceName: "Pineapple Juice", amountMl: 50, role: "required" },
  ]),
  R("iba-pisco-sour", "Pisco Sour", "皮斯科酸", C, "sour", ["sour", "herbal"], "Old Fashioned", "Angostura dashes", ["Shake with ice", "Strain"], [
    { sourceName: "Pisco", amountMl: 60, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 30, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 20, role: "required" },
    { sourceName: "Egg White", amountMl: 20, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "garnish" },
  ]),
  R("iba-sea-breeze", "Sea Breeze", "海风", C, "highball", ["fruity", "sour"], "Highball", "Lime", ["Build over ice"], [
    { sourceName: "Vodka", amountMl: 40, role: "required" },
    { sourceName: "Cranberry Juice", amountMl: 120, role: "required" },
    { sourceName: "Grapefruit Juice", amountMl: 30, role: "required" },
  ]),
  R("iba-sex-on-the-beach", "Sex on the Beach", "性感海滩", C, "highball", ["fruity", "sweet"], "Highball", "Orange", ["Build over ice"], [
    { sourceName: "Vodka", amountMl: 40, role: "required" },
    { sourceName: "Peach Schnapps", amountMl: 20, role: "required" },
    { sourceName: "Orange Juice", amountMl: 40, role: "required" },
    { sourceName: "Cranberry Juice", amountMl: 40, role: "required" },
  ]),
  R("iba-singapore-sling", "Singapore Sling", "新加坡司令", C, "punch_tiki", ["fruity", "herbal"], "Hurricane", "Pineapple and cherry", ["Shake with ice", "Strain over ice"], [
    { sourceName: "Gin", amountMl: 30, role: "required" },
    { sourceName: "Cherry Heering", amountMl: 15, role: "required" },
    { sourceName: "Triple Sec", amountMl: 7.5, role: "required" },
    { sourceName: "Bénédictine", amountMl: 7.5, role: "required" },
    { sourceName: "Pineapple Juice", amountMl: 120, role: "required" },
    { sourceName: "Lime Juice", amountMl: 15, role: "required" },
    { sourceName: "Grenadine", amountMl: 10, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-tequila-sunrise", "Tequila Sunrise", "龙舌兰日出", C, "highball", ["fruity", "sweet"], "Highball", "Orange and cherry", ["Build over ice", "Float grenadine"], [
    { sourceName: "Tequila", amountMl: 45, role: "required" },
    { sourceName: "Orange Juice", amountMl: 90, role: "required" },
    { sourceName: "Grenadine", amountMl: 15, role: "required" },
  ]),
  R("iba-vesper", "Vesper", "维斯珀", C, "martini_manhattan", ["dry", "herbal"], "Cocktail glass", "Lemon zest", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 45, role: "required" },
    { sourceName: "Vodka", amountMl: 15, role: "required" },
    { sourceName: "Lillet Blanc", amountMl: 7.5, role: "required" },
  ]),
  R("iba-zombie", "Zombie", "僵尸", C, "punch_tiki", ["fruity", "spicy"], "Tall glass", "Mint", ["Blend or shake with ice"], [
    { sourceName: "Dark Rum", amountMl: 45, role: "required" },
    { sourceName: "Gold Rum", amountMl: 45, role: "required" },
    { sourceName: "Overproof Rum", amountMl: 15, role: "required" },
    { sourceName: "Lime Juice", amountMl: 20, role: "required" },
    { sourceName: "Falernum", amountMl: 15, role: "required" },
    { sourceName: "Grenadine", amountMl: 5, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
    { sourceName: "Absinthe", amountMl: 5, role: "optional" },
  ]),
  R("iba-espresso-martini", "Espresso Martini", "浓缩咖啡马天尼", N, "other", ["bitter", "sweet"], "Cocktail glass", "Coffee beans", ["Shake with ice", "Strain"], [
    { sourceName: "Vodka", amountMl: 50, role: "required" },
    { sourceName: "Coffee Liqueur", amountMl: 30, role: "required" },
    { sourceName: "Espresso", amountMl: 25, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 5, role: "optional" },
  ]),
  R("iba-paper-plane", "Paper Plane", "纸飞机", N, "sour", ["bitter", "sour"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Bourbon", amountMl: 30, role: "required" },
    { sourceName: "Aperol", amountMl: 30, role: "required" },
    { sourceName: "Amaro Nonino", amountMl: 30, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 30, role: "required" },
  ]),
  R("iba-penicillin", "Penicillin", "青霉素", N, "sour", ["smoky", "sour"], "Old Fashioned", "Candied ginger", ["Shake", "Strain over ice", "Float Islay Scotch"], [
    { sourceName: "Scotch Whisky", amountMl: 45, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 22.5, role: "required" },
    { sourceName: "Honey Syrup", amountMl: 22.5, role: "required" },
    { sourceName: "Fresh Ginger", amountMl: null, role: "required" },
  ]),
  R("iba-tommy-margarita", "Tommy's Margarita", "汤米玛格丽特", N, "daisy", ["sour", "fruity"], "Old Fashioned", "Lime", ["Shake with ice", "Strain"], [
    { sourceName: "Tequila", amountMl: 60, role: "required" },
    { sourceName: "Lime Juice", amountMl: 30, role: "required" },
    { sourceName: "Agave Syrup", amountMl: 15, role: "required" },
  ]),
  R("iba-naked-and-famous", "Naked and Famous", "裸与名流", N, "sour", ["smoky", "bitter"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Mezcal", amountMl: 22.5, role: "required" },
    { sourceName: "Yellow Chartreuse", amountMl: 22.5, role: "required" },
    { sourceName: "Aperol", amountMl: 22.5, role: "required" },
    { sourceName: "Lime Juice", amountMl: 22.5, role: "required" },
  ]),
  R("iba-illegal", "Illegal", "非法", N, "sour", ["smoky", "herbal"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Mezcal", amountMl: 30, role: "required" },
    { sourceName: "Overproof Rum", amountMl: 15, role: "required" },
    { sourceName: "Lime Juice", amountMl: 22.5, role: "required" },
    { sourceName: "Maraschino Liqueur", amountMl: 15, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 15, role: "required" },
    { sourceName: "Egg White", amountMl: 20, role: "optional" },
  ]),
  R("iba-spicy-fifty", "Spicy Fifty", "辣五十", N, "sour", ["spicy", "fruity"], "Cocktail glass", "Red chili", ["Shake with ice", "Strain"], [
    { sourceName: "Vodka", amountMl: 50, role: "required" },
    { sourceName: "Elderflower Liqueur", amountMl: 15, role: "required" },
    { sourceName: "Lime Juice", amountMl: 15, role: "required" },
    { sourceName: "Honey Syrup", amountMl: 10, role: "required" },
    { sourceName: "Fresh Chili", amountMl: null, role: "required" },
  ]),
  R("iba-bramble", "Bramble", "荆棘", N, "sour", ["fruity", "sour"], "Old Fashioned", "Blackberry and lemon", ["Build over crushed ice", "Drizzle crème de mûre"], [
    { sourceName: "Gin", amountMl: 50, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 25, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 12.5, role: "required" },
    { sourceName: "Crème de Mûre", amountMl: 15, role: "required" },
  ]),
  R("iba-dark-n-stormy", "Dark ’n’ Stormy", "黑暗与风暴", N, "highball", ["spicy", "sour"], "Highball", "Lime", ["Build over ice"], [
    { sourceName: "Dark Rum", amountMl: 60, role: "required" },
    { sourceName: "Ginger Beer", amountMl: 100, role: "required" },
    { sourceName: "Lime Juice", amountMl: 10, role: "optional" },
  ]),
  R("iba-caipirinha", "Caipirinha", "卡皮利尼亚", C, "sour", ["sour", "sweet"], "Old Fashioned", "", ["Muddle lime with sugar", "Add cachaça and ice", "Stir"], [
    { sourceName: "Cachaça", amountMl: 60, role: "required" },
    { sourceName: "Lime Juice", amountMl: 30, role: "required" },
    { sourceName: "Sugar", amountMl: null, role: "required" },
  ]),
  R("iba-bellini", "Bellini", "贝里尼", C, "other", ["fruity", "sweet"], "Flute", "", ["Build in flute"], [
    { sourceName: "Prosecco", amountMl: 100, role: "required" },
    { sourceName: "White Peach Puree", amountMl: 50, role: "required" },
  ]),
  R("iba-black-russian", "Black Russian", "黑俄罗斯", C, "duo_trio", ["sweet", "bitter"], "Old Fashioned", "", ["Build over ice"], [
    { sourceName: "Vodka", amountMl: 50, role: "required" },
    { sourceName: "Coffee Liqueur", amountMl: 20, role: "required" },
  ]),
  R("iba-white-russian", "White Russian", "白俄罗斯", C, "duo_trio", ["creamy", "sweet"], "Old Fashioned", "", ["Build over ice", "Float cream"], [
    { sourceName: "Vodka", amountMl: 50, role: "required" },
    { sourceName: "Coffee Liqueur", amountMl: 20, role: "required" },
    { sourceName: "Cream", amountMl: 30, role: "required" },
  ]),
  R("iba-spritz", "Spritz", "斯普里茨", N, "spritz_cobbler", ["bitter", "dry"], "Wine glass", "Orange slice", ["Build over ice"], [
    { sourceName: "Aperol", amountMl: 90, role: "either", eitherGroupId: "spritz_bitter" },
    { sourceName: "Campari", amountMl: 90, role: "either", eitherGroupId: "spritz_bitter" },
    { sourceName: "Prosecco", amountMl: 60, role: "required" },
    { sourceName: "Soda Water", amountMl: 30, role: "required" },
  ]),
  // Additional classics (local corpus gap fill; IBA-style proportions)
  R("iba-gin-tonic", "Gin and Tonic", "金汤力", C, "highball", ["dry", "herbal"], "Highball", "Lime wedge", ["Build over ice", "Stir gently"], [
    { sourceName: "Gin", amountMl: 50, role: "required" },
    { sourceName: "Tonic Water", amountMl: 120, role: "required" },
    { sourceName: "Lime Juice", amountMl: 5, role: "optional" },
  ]),
  R("iba-screwdriver", "Screwdriver", "螺丝刀", C, "highball", ["fruity", "sweet"], "Highball", "Orange slice", ["Build over ice"], [
    { sourceName: "Vodka", amountMl: 50, role: "required" },
    { sourceName: "Orange Juice", amountMl: 100, role: "required" },
  ]),
  R("iba-gimlet", "Gimlet", "吉姆雷特", U, "sour", ["sour", "dry"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 60, role: "required" },
    { sourceName: "Lime Juice", amountMl: 20, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 10, role: "required" },
  ]),
  R("iba-tom-collins", "Tom Collins", "汤姆柯林斯", U, "collins_fizz", ["sour", "sweet"], "Highball", "Lemon and cherry", ["Build or shake", "Top with soda"], [
    { sourceName: "Old Tom Gin", amountMl: 45, role: "either", eitherGroupId: "collins_gin" },
    { sourceName: "Gin", amountMl: 45, role: "either", eitherGroupId: "collins_gin" },
    { sourceName: "Lemon Juice", amountMl: 30, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 15, role: "required" },
    { sourceName: "Soda Water", amountMl: 60, role: "required" },
  ]),
  R("iba-rob-roy", "Rob Roy", "罗布罗伊", U, "martini_manhattan", ["sweet", "smoky"], "Cocktail glass", "Cherry", ["Stir with ice", "Strain"], [
    { sourceName: "Scotch Whisky", amountMl: 50, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 20, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-paloma", "Paloma", "帕洛玛", C, "highball", ["sour", "fruity"], "Highball", "Lime wedge", ["Build over ice", "Top with grapefruit soda"], [
    { sourceName: "Tequila", amountMl: 50, role: "required" },
    { sourceName: "Lime Juice", amountMl: 20, role: "required" },
    { sourceName: "Grapefruit Soda", amountMl: 100, role: "required" },
    { sourceName: "Salt", amountMl: null, role: "optional" },
  ]),
  R("iba-amaretto-sour", "Amaretto Sour", "杏仁酸", C, "sour", ["sour", "nutty"], "Old Fashioned", "Cherry and orange", ["Shake with ice", "Strain"], [
    { sourceName: "Amaretto", amountMl: 45, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 25, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 10, role: "optional" },
    { sourceName: "Egg White", amountMl: 20, role: "optional" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "optional" },
  ]),
  R("iba-godfather", "Godfather", "教父", C, "duo_trio", ["sweet", "nutty"], "Old Fashioned", "", ["Build over ice", "Stir"], [
    { sourceName: "Scotch Whisky", amountMl: 35, role: "required" },
    { sourceName: "Amaretto", amountMl: 35, role: "required" },
  ]),
  R("iba-grasshopper", "Grasshopper", "蚱蜢", C, "other", ["sweet", "creamy"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Crème de Menthe", amountMl: 20, role: "required" },
    { sourceName: "Crème de Cacao", amountMl: 20, role: "required" },
    { sourceName: "Cream", amountMl: 20, role: "required" },
  ]),
  R("iba-brandy-alexander", "Brandy Alexander", "白兰地亚历山大", U, "other", ["sweet", "creamy"], "Cocktail glass", "Nutmeg", ["Shake with ice", "Strain"], [
    { sourceName: "Cognac", amountMl: 30, role: "required" },
    { sourceName: "Crème de Cacao", amountMl: 30, role: "required" },
    { sourceName: "Cream", amountMl: 30, role: "required" },
  ]),
  R("iba-corpse-reviver-2", "Corpse Reviver No. 2", "起尸酒二号", U, "sour", ["sour", "herbal"], "Cocktail glass", "", ["Rinse glass with absinthe", "Shake remaining with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 22.5, role: "required" },
    { sourceName: "Triple Sec", amountMl: 22.5, role: "required" },
    { sourceName: "Lillet Blanc", amountMl: 22.5, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 22.5, role: "required" },
    { sourceName: "Absinthe", amountMl: 2, role: "required" },
  ]),
  R("iba-bees-knees", "Bee's Knees", "蜂之膝", U, "sour", ["sour", "sweet"], "Cocktail glass", "", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 52.5, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 22.5, role: "required" },
    { sourceName: "Honey Syrup", amountMl: 22.5, role: "required" },
  ]),
  R("iba-champagne-cocktail", "Champagne Cocktail", "香槟鸡尾酒", U, "other", ["dry", "bitter"], "Flute", "Orange twist", ["Place sugar soaked with bitters", "Top with champagne"], [
    { sourceName: "Champagne", amountMl: 90, role: "required" },
    { sourceName: "Sugar", amountMl: null, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
    { sourceName: "Cognac", amountMl: 10, role: "optional" },
  ]),
  R("iba-kir-royale", "Kir Royale", "皇家基尔", C, "other", ["fruity", "dry"], "Flute", "", ["Add cassis", "Top with champagne"], [
    { sourceName: "Crème de Cassis", amountMl: 10, role: "required" },
    { sourceName: "Champagne", amountMl: 90, role: "required" },
  ]),
  R("iba-vieux-carre", "Vieux Carré", "老广场", U, "old_fashioned", ["sweet", "herbal"], "Old Fashioned", "Lemon twist", ["Stir with ice", "Strain over ice"], [
    { sourceName: "Rye Whiskey", amountMl: 30, role: "required" },
    { sourceName: "Cognac", amountMl: 30, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 30, role: "required" },
    { sourceName: "Bénédictine", amountMl: 7.5, role: "required" },
    { sourceName: "Peychaud's Bitters", amountMl: 2, role: "required" },
    { sourceName: "Angostura Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-blood-and-sand", "Blood and Sand", "血与沙", U, "sour", ["fruity", "sweet"], "Cocktail glass", "Orange twist", ["Shake with ice", "Strain"], [
    { sourceName: "Scotch Whisky", amountMl: 22.5, role: "required" },
    { sourceName: "Cherry Heering", amountMl: 22.5, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 22.5, role: "required" },
    { sourceName: "Orange Juice", amountMl: 22.5, role: "required" },
  ]),
  R("iba-gin-rickey", "Gin Rickey", "金酒瑞基", U, "highball", ["sour", "dry"], "Highball", "Lime", ["Build over ice"], [
    { sourceName: "Gin", amountMl: 50, role: "required" },
    { sourceName: "Lime Juice", amountMl: 15, role: "required" },
    { sourceName: "Soda Water", amountMl: 120, role: "required" },
  ]),
  R("iba-whisky-highball", "Whisky Highball", "威士忌嗨棒", C, "highball", ["dry", "spicy"], "Highball", "Lemon twist", ["Build over ice", "Top with ginger ale or soda"], [
    { sourceName: "Scotch Whisky", amountMl: 45, role: "either", eitherGroupId: "highball_whisky" },
    { sourceName: "Whiskey", amountMl: 45, role: "either", eitherGroupId: "highball_whisky" },
    { sourceName: "Ginger Ale", amountMl: 120, role: "either", eitherGroupId: "highball_top" },
    { sourceName: "Soda Water", amountMl: 120, role: "either", eitherGroupId: "highball_top" },
  ]),
  R("iba-caipiroska", "Caipiroska", "卡皮洛斯卡", C, "sour", ["sour", "sweet"], "Old Fashioned", "", ["Muddle lime with sugar", "Add vodka and ice", "Stir"], [
    { sourceName: "Vodka", amountMl: 60, role: "required" },
    { sourceName: "Lime Juice", amountMl: 30, role: "required" },
    { sourceName: "Sugar", amountMl: null, role: "required" },
  ]),
  R("iba-french-connection", "French Connection", "法国关系", C, "duo_trio", ["sweet", "nutty"], "Old Fashioned", "", ["Build over ice"], [
    { sourceName: "Cognac", amountMl: 35, role: "required" },
    { sourceName: "Amaretto", amountMl: 35, role: "required" },
  ]),
  R("iba-blue-lagoon", "Blue Lagoon", "蓝湖", C, "highball", ["fruity", "sweet"], "Highball", "Lemon", ["Build over ice"], [
    { sourceName: "Vodka", amountMl: 40, role: "required" },
    { sourceName: "Blue Curaçao", amountMl: 20, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 15, role: "required" },
    { sourceName: "Soda Water", amountMl: 80, role: "required" },
  ]),
  R("iba-adonis", "Adonis", "阿多尼斯", U, "martini_manhattan", ["sweet", "dry"], "Cocktail glass", "Orange twist", ["Stir with ice", "Strain"], [
    { sourceName: "Sherry", amountMl: 60, role: "required" },
    { sourceName: "Sweet Red Vermouth", amountMl: 30, role: "required" },
    { sourceName: "Orange Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-bamboo", "Bamboo", "竹林", U, "martini_manhattan", ["dry", "herbal"], "Cocktail glass", "Lemon twist", ["Stir with ice", "Strain"], [
    { sourceName: "Fino Sherry", amountMl: 45, role: "required" },
    { sourceName: "Dry Vermouth", amountMl: 45, role: "required" },
    { sourceName: "Orange Bitters", amountMl: 2, role: "required" },
  ]),
  R("iba-southside", "Southside", "南边", U, "sour", ["herbal", "sour"], "Cocktail glass", "Mint", ["Shake with ice", "Strain"], [
    { sourceName: "Gin", amountMl: 60, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 30, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 15, role: "required" },
    { sourceName: "Mint", amountMl: null, role: "required" },
  ]),
  R("iba-gold-rush", "Gold Rush", "淘金热", N, "sour", ["sour", "sweet"], "Old Fashioned", "", ["Shake with ice", "Strain over ice"], [
    { sourceName: "Bourbon", amountMl: 60, role: "required" },
    { sourceName: "Lemon Juice", amountMl: 22.5, role: "required" },
    { sourceName: "Honey Syrup", amountMl: 22.5, role: "required" },
  ]),
  R("iba-painkiller", "Painkiller", "止痛药", C, "punch_tiki", ["fruity", "creamy"], "Hurricane", "Nutmeg and pineapple", ["Shake or blend with ice"], [
    { sourceName: "Dark Rum", amountMl: 60, role: "required" },
    { sourceName: "Pineapple Juice", amountMl: 120, role: "required" },
    { sourceName: "Orange Juice", amountMl: 30, role: "required" },
    { sourceName: "Coconut Cream", amountMl: 30, role: "required" },
  ]),
  R("iba-jungle-bird", "Jungle Bird", "丛林鸟", N, "punch_tiki", ["bitter", "fruity"], "Old Fashioned", "Pineapple", ["Shake with ice", "Strain over ice"], [
    { sourceName: "Dark Rum", amountMl: 45, role: "required" },
    { sourceName: "Campari", amountMl: 22.5, role: "required" },
    { sourceName: "Pineapple Juice", amountMl: 45, role: "required" },
    { sourceName: "Lime Juice", amountMl: 15, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 15, role: "required" },
  ]),
  R("iba-new-york-sour", "New York Sour", "纽约酸", C, "sour", ["sour", "fruity"], "Old Fashioned", "", ["Shake whiskey sour", "Strain", "Float red wine"], [
    { sourceName: "Rye Whiskey", amountMl: 60, role: "either", eitherGroupId: "nys_whiskey" },
    { sourceName: "Bourbon", amountMl: 60, role: "either", eitherGroupId: "nys_whiskey" },
    { sourceName: "Lemon Juice", amountMl: 30, role: "required" },
    { sourceName: "Simple Syrup", amountMl: 22.5, role: "required" },
    { sourceName: "Egg White", amountMl: 20, role: "optional" },
    { sourceName: "Red Wine", amountMl: 15, role: "required" },
  ]),
  // Explicit new_version example (same logical drink, alternate published primary candidate)
  {
    id: "iba-negroni-v2-sbagliato-note",
    importKind: "new_version",
    targetRecipeId: "iba-negroni",
    nameZh: "内格罗尼",
    nameEn: "Negroni",
    ibaCategory: U,
    sourceName: "IBA Official Cocktails (local corpus snapshot)",
    sourceRevision: "editorial-alt-2024",
    familyId: "duo_trio",
    flavorTagIds: ["bitter", "sweet"],
    glassware: "Old Fashioned",
    garnish: "Orange slice",
    steps: ["Stir with ice", "Strain into rocks glass with large cube", "Express orange oil"],
    ingredients: [
      { sourceName: "Gin", amountMl: 30, role: "required" },
      { sourceName: "Campari", amountMl: 30, role: "required" },
      { sourceName: "Sweet Red Vermouth", amountMl: 30, role: "required" },
    ],
  },
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const out = path.join(root, "data/iba/recipes/iba_recipes.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(recipes, null, 2), "utf8");
console.log(`Wrote ${recipes.length} recipes to ${out}`);
