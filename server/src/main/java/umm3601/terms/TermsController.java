// Package
package umm3601.terms;

// Java imports
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeSet;

// Org imports
import org.bson.Document;

// Com imports
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;

// Javalin imports
import io.javalin.http.Context;
import io.javalin.http.HttpStatus;

// App imports
import umm3601.Auth.HttpMethod;
import umm3601.Auth.Route;

/**
 * Controller that aggregates distinct vocabulary terms from both the
 * supplylist and inventory collections, providing a single endpoint
 * to power autocomplete on the add-item forms.
 */
public class TermsController {
  private static final String API_TERMS = "/api/terms";

  /**
   * Canonical lists of item, brand, color, size, type, and material names used for standardizing
   * and validating input on the add-item and edit-item forms.
   * These lists are derived from the 2026 live supplylist and inventory collections and are subject
   * to change over time. Though it's unlikely to alter in the future. But important to keep in mind.
   */

  // Canonical lists of terms for items
  private static final List<String> CANONICAL_ITEMS = List.of(
    "Composition Notebook", "Construction Paper", "Facial Tissue", "Index Card",
    "Loose-Leaf Paper", "Notebook", "Page Protector", "Paper Plate", "Single-Subject Notebook", "Single-Subject Spiral Notebook",
    "Spiral Notebook", "Sticky Note", "Colored Pencil", "Crayon", "Dry Erase Marker",
    "Eraser", "Glue Stick", "Highlighter", "Liquid Glue", "Marker", "Washable Marker", "Pencil", "Pen",
    "Permanent Marker", "Watercolor Paint", "3-Hole Folder", "3-Prong Folder",
    "3-Ring Binder", "Backpack", "Bag", "Folder", "Pencil Box", "Pencil Pouch", "Tab Divider",
    "Calculator", "Headphones", "Pencil Sharpener", "Ruler", "Scientific Calculator", "Compass", "Computer Mouse", "Earbuds",
    "Scissors", "Whiteboard Eraser", "Blanket", "Bowl", "Cup", "Disinfectant Wipes",
    "Fork", "Paper Towel Roll", "Planner", "Protractor", "Rug", "Sketchbook", "Snack", "Spoon",
    "Storage Bag", "Tennis Shoes", "Toothbrush Holder", "Towel", "Water Bottle"
  );

  // Canonical lists of terms for brands
  private static final List<String> CANONICAL_BRANDS = List.of(
    "BIC", "Clorox", "Crayola", "Deal Worthy", "Dixie", "Elmer's", "Expo", "Fiskars",
    "Just Basics", "Kleenex", "Lysol", "Office Depot", "Paper Mate", "Pen+Gear", "Pentel",
    "Quill", "Sharpie", "Solo", "Texas Instruments", "Ticonderoga", "Up & Up", "Westcott",
    "Ziploc"
  );

  // Canonical lists of terms for colors
  private static final List<String> CANONICAL_COLORS = List.of(
    "Assorted", "Black", "Blue", "Gray", "Green", "Orange", "Pink", "Purple", "Red",
    "White", "Yellow"
  );

  // Canonical lists of terms for sizes
  private static final List<String> CANONICAL_SIZES = List.of(
    "1 in", "1.5 in", "4 oz", "5 in", "7 in", "8 in x 5 in", "10 oz", "Small", "Medium", "Large", "Regular",
    "Jumbo", "Quart", "Gallon"
  );
  // Canonical lists of terms for types
  private static final List<String> CANONICAL_TYPES = List.of(
    "#2", "#2 Sharpened", "#2 Unsharpened", "2-Pocket", "Ballpoint", "Broad Tip", "Wide Tip",
    "Chisel Tip", "Coated", "Hard", "Sharpened", "College Ruled", "Fine Tip", "Front Pocket", "Grid Ruled",
    "Mechanical", "Pink Pearl", "Single Subject", "Wide Ruled"
  );
  // Canonical lists of terms for materials
  private static final List<String> CANONICAL_MATERIALS = List.of(
    "Fabric", "Paper", "Plastic", "Polymer", "Polypropylene"
  );

  private static final List<String> PACKAGED_ITEMS = List.of(
    "Construction Paper", "Crayon", "Disinfectant Wipes", "Facial Tissue", "Index Card",
    "Loose-Leaf Paper", "Marker", "Washable Marker", "Page Protector", "Paper Plate", "Snack",
    "Sticky Note", "Storage Bag", "Tab Divider", "Watercolor Paint"
  );

  // Known aliases for terms to handle common variations and misspellings
  private static final Map<String, String> KNOWN_ALIASES = Map.ofEntries(
    // TODO Consider string toTitle functions instead of manually listing aliases pertains to client side too
    Map.entry("3 ring binder", "3-Ring Binder"),
    Map.entry("3-ring binder", "3-Ring Binder"),
    Map.entry("3 prong folder", "3-Prong Folder"),
    Map.entry("3-prong folder", "3-Prong Folder"),
    Map.entry("3 hole folder", "3-Hole Folder"),
    Map.entry("3-hole folder", "3-Hole Folder"),
    Map.entry("folders", "Folder"),
    Map.entry("glue sticks", "Glue Stick"),
    Map.entry("white board eraser", "Whiteboard Eraser"),
    Map.entry("dry board eraser", "Whiteboard Eraser"),
    Map.entry("school box", "Pencil Box"),
    Map.entry("pencil/crayon box", "Pencil Box"),
    Map.entry("binder pencil pouch", "Pencil Pouch"),
    Map.entry("3-ring binder pencil pouch", "Pencil Pouch"),
    Map.entry("pencil zipper pouch", "Pencil Pouch"),
    Map.entry("single subject notebook", "Single-Subject Notebook"),
    Map.entry("spiral tablet", "Spiral Notebook"),
    Map.entry("tablet", "Notebook"),
    Map.entry("school glue", "Liquid Glue"),
    Map.entry("bottle of glue", "Liquid Glue"),
    Map.entry("filler paper", "Loose-Leaf Paper"),
    Map.entry("notecards", "Index Card"),
    Map.entry("pocket", "2-Pocket"),
    Map.entry("double pocket", "2-Pocket"),
    Map.entry("thick", "Large"),
    Map.entry("thicker", "Large"),
    Map.entry("fiskar", "Fiskars"),
    Map.entry("no. 2", "#2"),
    Map.entry("elmers", "Elmer's"),
    Map.entry("wide rule", "Wide Ruled"),
    Map.entry("front pocket", "Front Pocket"),
    Map.entry("fine", "Fine Tip"),
    Map.entry("chisel", "Chisel Tip"),
    Map.entry("misc", "Assorted"),
    Map.entry("six color", "Assorted"),

    // TODO: For number values, can we summarize it to be more generally applicable, in hand with "oz", "in", etc.? same for client side too
    // Ex. "[0-9]+in" -> "0$ in"? etc.
    Map.entry("5in", "5 in"),
    Map.entry("7in", "7 in"),
    Map.entry("1 inch", "1 in"),
    Map.entry("1.5 inch", "1.5 in")
  );

  // MongoDB collections for supply list and inventory
  private final MongoCollection<Document> supplyListCollection;
  private final MongoCollection<Document> inventoryCollection;

  // Constructor for TermsController, initializes MongoDB collections for supply list and inventory
  public TermsController(MongoDatabase database) {
    supplyListCollection = database.getCollection("supplylist");
    inventoryCollection = database.getCollection("inventory");
  }

  /**
   * getTerms merges distinct values from supplylist and inventory collections for each of the term categories:
   * item, brand, color, size, type, and material. It normalizes the terms by trimming whitespace. The merged lists
   * are case-insensitively deduplicated and sorted before being returned
   * as a JSON response with a 200 OK status.
   * @param ctx
   */
  @Route(method = HttpMethod.GET, path = API_TERMS)
  public void getTerms(Context ctx) {
    Terms terms = new Terms(); // Initialize a new Terms object to hold merged and normalized term lists
    // Autocomplete is intentionally catalog-driven. Reading arbitrary stored
    // values back into this response made deleted/legacy mistakes become valid
    // suggestions again.
    terms.item = sorted(CANONICAL_ITEMS);
    terms.brand = sorted(CANONICAL_BRANDS);
    terms.color = sorted(CANONICAL_COLORS);
    terms.size = sorted(CANONICAL_SIZES);
    terms.type = sorted(CANONICAL_TYPES);
    terms.material = sorted(CANONICAL_MATERIALS);
    terms.itemPackageModes = new LinkedHashMap<>();
    for (String item : terms.item) {
      terms.itemPackageModes.put(item, PACKAGED_ITEMS.contains(item) ? "PACKAGED" : "INDIVIDUAL");
    }

    ctx.json(terms); // Return the merged and normalized terms as JSON response
    ctx.status(HttpStatus.OK); // Set HTTP status to 200 OK
  }

  private List<String> sorted(List<String> values) {
    TreeSet<String> sorted = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    sorted.addAll(values);
    return new ArrayList<>(sorted);
  }

  /**
   * Removes terms like "#2" from type when they also exist in size.
   * These tokens are pencil-size markers and should not be suggested as type.
   */
  // TODO: Is this still necessary given the validation to be soon hard implemented?
  private List<String> removeOverlappingSizeMarkers(List<String> typeTerms, List<String> sizeTerms) {
    TreeSet<String> sizeMarkers = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    for (String size : sizeTerms) {
      if (isHashNumberMarker(size)) {
        sizeMarkers.add(size.trim());
      }
    }

    List<String> filtered = new ArrayList<>();
    for (String type : typeTerms) {
      if (!(isHashNumberMarker(type) && sizeMarkers.contains(type.trim()))) {
        filtered.add(type);
      }
    }
    return filtered;
  }

  /** Matches tokens like #2, #2b, #10. */
  private boolean isHashNumberMarker(String value) {
    if (value == null) {
      return false;
    }
    return value.trim().matches("(?i)^#[0-9]+[a-z]?$");
  }

  /**
   * Runs MongoDB distinct() and strips blank values. Stored terms remain canonical;
   * matching aliases belong in the description parser, not in this endpoint.
   */
  private List<String> distinctStrings(MongoCollection<Document> collection, String field) {
    List<String> result = new ArrayList<>();
    collection.distinct(field, String.class)
        .forEach(v -> {
          if (v != null && !v.isBlank()) {
            result.add(v.trim());
          }
        });
    return result;
  }

  /** Merges multiple lists into one sorted, case-deduplicated list. */
  @SafeVarargs
  private List<String> merge(List<String>... lists) {
    TreeSet<String> set = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    for (List<String> list : lists) {
      for (String value : list) {
        set.add(normalizeKnownAlias(value));
      }
    }
    return new ArrayList<>(set);
  }

  /**
   * Normalizes a known alias to its canonical form if it exists.
   * Trims the input value and checks against a map of known aliases.
   * If a canonical term matches (case-insensitive), it returns the canonical term.
   * Otherwise, it returns the normalized value itself.
   * @param value The input value to normalize.
   * @return The canonical form of the input value if it exists, otherwise the normalized value itself.
   */
  private String normalizeKnownAlias(String value) {
    String trimmed = value.trim();

    // Normalize the input value using the known aliases map.
    String normalized = KNOWN_ALIASES.getOrDefault(trimmed.toLowerCase(Locale.ROOT), trimmed);

    // Check against all canonical terms to find a case-insensitive match.
    for (List<String> canonicalTerms : List.of(
      CANONICAL_ITEMS,
      CANONICAL_BRANDS,
      CANONICAL_COLORS,
      CANONICAL_SIZES,
      CANONICAL_TYPES,
      CANONICAL_MATERIALS
    )) {
      // Iterate through each canonical term to find a case-insensitive match.
      for (String canonical : canonicalTerms) {
        if (canonical.equalsIgnoreCase(normalized)) {
          return canonical;
        }
      }
    }
    return normalized;
  }
}
