import { Header } from "../Header";
import { ThemeProvider } from "../ThemeProvider";

export default function HeaderExample() {
  return (
    <ThemeProvider>
      <Header onManageBooking={() => console.log("Manage booking clicked")} />
    </ThemeProvider>
  );
}
