import { SearchForm } from "../SearchForm";
import { ThemeProvider } from "../ThemeProvider";

export default function SearchFormExample() {
  return (
    <ThemeProvider>
      <div className="p-6 max-w-md bg-background">
        <SearchForm onSearch={(data) => console.log("Search data:", data)} />
      </div>
    </ThemeProvider>
  );
}
