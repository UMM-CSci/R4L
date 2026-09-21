// Package
package umm3601.Terms;

// Java imports
import java.util.ArrayList;
import java.util.List;
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
  // Complete item phrases that should take precedence over nested attribute words,
  // even when they are not yet represented in the current inventory.
  private static final List<String> CURATED_ITEMS = List.of("Construction Paper");

  private final MongoCollection<Document> supplyListCollection;
  private final MongoCollection<Document> inventoryCollection;

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
    Terms terms = new Terms();

    terms.item = merge(
      distinctStrings(supplyListCollection, "item"),
      distinctStrings(inventoryCollection, "item"),
      CURATED_ITEMS
    );

    terms.brand = merge(
      distinctStrings(supplyListCollection, "brand.exactly"),
      distinctStrings(supplyListCollection, "brand.anyOf"),
      distinctStrings(inventoryCollection, "brand")
    );

    terms.color = merge(
      distinctStrings(supplyListCollection, "color.exactly"),
      distinctStrings(supplyListCollection, "color.anyOf"),
      distinctStrings(inventoryCollection, "color")
    );

    terms.size = merge(
      distinctStrings(supplyListCollection, "size.exactly"),
      distinctStrings(supplyListCollection, "size.anyOf"),
      distinctStrings(inventoryCollection, "size")
    );

    terms.type = merge(
      distinctStrings(supplyListCollection, "type.exactly"),
      distinctStrings(supplyListCollection, "type.anyOf"),
      distinctStrings(inventoryCollection, "type")
    );

    terms.material = merge(
      distinctStrings(supplyListCollection, "material.exactly"),
      distinctStrings(supplyListCollection, "material.anyOf"),
      distinctStrings(inventoryCollection, "material")
    );

    terms.type = removeOverlappingSizeMarkers(terms.type, terms.size);

    ctx.json(terms);
    ctx.status(HttpStatus.OK);
  }

  /**
   * Removes terms like "#2" from type when they also exist in size.
   * These tokens are pencil-size markers and should not be suggested as type.
   */
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
      set.addAll(list);
    }
    return new ArrayList<>(set);
  }

}
