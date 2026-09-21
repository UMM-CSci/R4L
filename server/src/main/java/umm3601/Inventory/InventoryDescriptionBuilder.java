package umm3601.Inventory;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.StringJoiner;

/** Formats inventory fields without repeating a word already supplied by the item name. */
public final class InventoryDescriptionBuilder {
  private InventoryDescriptionBuilder() {
  }

  public static String build(Inventory inventory) {
    String item = meaningful(inventory.item) ? inventory.item.trim() : "";
    String type = meaningful(inventory.type) ? inventory.type.trim() : "";

    // Legacy inventory stores "Glue" + type "Stick" instead of the complete
    // item name "Glue Stick". Keep it readable until that data can be migrated.
    if (item.equalsIgnoreCase("Glue") && type.equalsIgnoreCase("Stick")) {
      item = "Glue Stick";
      type = "";
    }

    StringJoiner main = new StringJoiner(" ");
    if (inventory.packageSize > 1 && !item.isEmpty()) {
      main.add(inventory.packageSize + " Pack of");
    }

    List<String> accepted = new ArrayList<>();
    addDistinct(main, accepted, inventory.brand, item);
    addDistinct(main, accepted, inventory.size, item);
    addDistinct(main, accepted, inventory.color, item);
    addDistinct(main, accepted, type, item);
    if (!item.isEmpty()) {
      main.add(inventory.packageSize > 1 ? pluralize(item) : item);
    }

    String description = main.toString();
    if (meaningful(inventory.material)
        && !overlaps(inventory.material, item)
        && accepted.stream().noneMatch(value -> overlaps(inventory.material, value))) {
      String material = inventory.material.trim();
      return description.isEmpty() ? material : description + " (" + material + ")";
    }
    return description;
  }

  private static void addDistinct(StringJoiner output, List<String> accepted, String value, String item) {
    if (!meaningful(value) || overlaps(value, item)
        || accepted.stream().anyMatch(other -> overlaps(value, other))) {
      return;
    }
    String trimmed = value.trim();
    output.add(trimmed);
    accepted.add(trimmed);
  }

  private static boolean overlaps(String first, String second) {
    String a = normalize(first);
    String b = normalize(second);
    return !a.isEmpty() && !b.isEmpty()
      && (containsPhrase(a, b) || containsPhrase(b, a));
  }

  private static boolean containsPhrase(String text, String phrase) {
    return (" " + text + " ").contains(" " + phrase + " ");
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT)
      .replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
  }

  private static boolean meaningful(String value) {
    return value != null && !value.isBlank() && !value.trim().equalsIgnoreCase("N/A");
  }

  private static String pluralize(String item) {
    if (item.matches("(?i).*[^aeiou]y")) {
      return item.substring(0, item.length() - 1) + "ies";
    }
    if (item.matches("(?i).*(?:ch|sh|x|z)")) {
      return item + "es";
    }
    return item.endsWith("s") ? item : item + "s";
  }
}
