import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { UserShell } from "./layouts/UserShell";
import { AdminShell } from "./layouts/AdminShell";
import { RequireAdmin } from "./components/RequireAdmin";
import { HomePage } from "./pages/HomePage";
import { RecipeDetailPage } from "./pages/RecipeDetailPage";
import { BarPage } from "./pages/BarPage";
import { AiChatPage } from "./pages/AiChatPage";
import { AdminHomePage } from "./pages/admin/AdminHomePage";
import { AdminRecipesPage } from "./pages/admin/AdminRecipesPage";
import { AdminRecipeEditPage } from "./pages/admin/AdminRecipeEditPage";
import { AdminIngredientsPage } from "./pages/admin/AdminIngredientsPage";
import { AdminTaxonomyPage } from "./pages/admin/AdminTaxonomyPage";
import { AdminRecipeImportPage } from "./pages/admin/AdminRecipeImportPage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<UserShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/bar" element={<BarPage />} />
          <Route path="/ai" element={<AiChatPage />} />
        </Route>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<RequireAdmin />}>
          <Route element={<AdminShell />}>
            <Route index element={<AdminHomePage />} />
            <Route path="recipes" element={<AdminRecipesPage />} />
            <Route path="recipes/import" element={<AdminRecipeImportPage />} />
            <Route path="recipes/new" element={<AdminRecipeEditPage />} />
            <Route path="recipes/:id" element={<AdminRecipeEditPage />} />
            <Route path="ingredients" element={<AdminIngredientsPage />} />
            <Route path="taxonomy" element={<AdminTaxonomyPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
