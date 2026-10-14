package umm3601.Terms;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mongodb.client.DistinctIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import io.javalin.http.Context;
import io.javalin.http.HttpStatus;
import umm3601.terms.Terms;
import umm3601.terms.TermsController;

import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.Consumer;

class TermsControllerSpec {

  private MongoCollection<Document> supplyListCollection;
  private MongoCollection<Document> inventoryCollection;
  private MongoDatabase db;
  private TermsController controller;
  private Context ctx;

  @SuppressWarnings("unchecked")
  @BeforeEach
  void setup() {
    db = mock(MongoDatabase.class);
    supplyListCollection = mock(MongoCollection.class);
    inventoryCollection = mock(MongoCollection.class);
    when(db.getCollection("supplylist")).thenReturn(supplyListCollection);
    when(db.getCollection("inventory")).thenReturn(inventoryCollection);
    controller = new TermsController(db);
    ctx = mock(Context.class);
  }

  /** Helper: creates a DistinctIterable mock that feeds the given values to forEach(). */
  @SuppressWarnings("unchecked")
  private DistinctIterable<String> makeIterable(List<String> values) {
    DistinctIterable<String> iterable = mock(DistinctIterable.class);
    doAnswer(inv -> {
      Consumer<String> consumer = (Consumer<String>) inv.getArgument(0);
      for (String v : values) {
        consumer.accept(v);
      }
      return null;
    }).when(iterable).forEach(any());
    return iterable;
  }

  @Test
  void getTermsReturnsCanonicalCatalogInsteadOfPromotingStoredMistakes() {
    DistinctIterable<String> slItem = makeIterable(Arrays.asList("Crayons", "Markers"));
    DistinctIterable<String> slBrandA = makeIterable(Arrays.asList("Crayola", "BIC"));
    DistinctIterable<String> slBrandO = makeIterable(Arrays.asList("Expo"));
    DistinctIterable<String> slColorA = makeIterable(Arrays.asList("Red", "Blue"));
    DistinctIterable<String> slColorO = makeIterable(Arrays.asList("Green"));
    DistinctIterable<String> slSizeA = makeIterable(Arrays.asList("Large"));
    DistinctIterable<String> slSizeO = makeIterable(Arrays.asList("Boxes"));
    DistinctIterable<String> slTypeA = makeIterable(Arrays.asList("Washable"));
    DistinctIterable<String> slTypeO = makeIterable(Arrays.asList("Permanent"));
    DistinctIterable<String> slMatA = makeIterable(Arrays.asList("Plastic"));
    DistinctIterable<String> slMatO = makeIterable(Arrays.asList("Wood"));

    DistinctIterable<String> invItem = makeIterable(Arrays.asList("Pencil", "crayon"));
    DistinctIterable<String> invBrand = makeIterable(Arrays.asList("BIC", "Papermate"));
    DistinctIterable<String> invColor = makeIterable(Arrays.asList("Blue", "Yellow"));
    DistinctIterable<String> invSize = makeIterable(Arrays.asList("Small"));
    DistinctIterable<String> invType = makeIterable(Arrays.asList("Permanent", "Dry Erase"));
    DistinctIterable<String> invMat = makeIterable(Arrays.asList("Metal"));

    when(supplyListCollection.distinct(eq("item"), eq(String.class))).thenReturn(slItem);
    when(supplyListCollection.distinct(eq("brand.exactly"), eq(String.class))).thenReturn(slBrandA);
    when(supplyListCollection.distinct(eq("brand.anyOf"), eq(String.class))).thenReturn(slBrandO);
    when(supplyListCollection.distinct(eq("color.exactly"), eq(String.class))).thenReturn(slColorA);
    when(supplyListCollection.distinct(eq("color.anyOf"), eq(String.class))).thenReturn(slColorO);
    when(supplyListCollection.distinct(eq("size.exactly"), eq(String.class))).thenReturn(slSizeA);
    when(supplyListCollection.distinct(eq("size.anyOf"), eq(String.class))).thenReturn(slSizeO);
    when(supplyListCollection.distinct(eq("type.exactly"), eq(String.class))).thenReturn(slTypeA);
    when(supplyListCollection.distinct(eq("type.anyOf"), eq(String.class))).thenReturn(slTypeO);
    when(supplyListCollection.distinct(eq("material.exactly"), eq(String.class))).thenReturn(slMatA);
    when(supplyListCollection.distinct(eq("material.anyOf"), eq(String.class))).thenReturn(slMatO);

    when(inventoryCollection.distinct(eq("item"), eq(String.class))).thenReturn(invItem);
    when(inventoryCollection.distinct(eq("brand"), eq(String.class))).thenReturn(invBrand);
    when(inventoryCollection.distinct(eq("color"), eq(String.class))).thenReturn(invColor);
    when(inventoryCollection.distinct(eq("size"), eq(String.class))).thenReturn(invSize);
    when(inventoryCollection.distinct(eq("type"), eq(String.class))).thenReturn(invType);
    when(inventoryCollection.distinct(eq("material"), eq(String.class))).thenReturn(invMat);

    doAnswer(inv -> {
      Terms terms = inv.getArgument(0);
      assertTrue(terms.item.containsAll(List.of("Construction Paper", "Crayon", "Pencil", "Washable Marker")));
      assertFalse(terms.item.contains("Crayons"));
      assertFalse(terms.item.contains("Markers"));
      assertTrue(terms.brand.containsAll(List.of("BIC", "Crayola", "Expo")));
      assertTrue(terms.color.containsAll(List.of("Blue", "Green", "Red", "Yellow")));
      assertFalse(terms.size.contains("Boxes"));
      assertFalse(terms.type.contains("Washable"));
      assertFalse(terms.material.contains("Metal"));
      assertTrue(terms.itemPackageModes.get("Crayon").equals("PACKAGED"));
      assertTrue(terms.itemPackageModes.get("Snack").equals("PACKAGED"));
      assertTrue(terms.itemPackageModes.get("Dry Erase Marker").equals("INDIVIDUAL"));
      assertTrue(terms.itemPackageModes.get("Permanent Marker").equals("INDIVIDUAL"));
      assertTrue(terms.itemPackageModes.get("Pencil").equals("INDIVIDUAL"));
      return null;
    }).when(ctx).json(any(Terms.class));

    controller.getTerms(ctx);
    verify(ctx).json(any(Terms.class));
    verify(ctx).status(eq(HttpStatus.OK));
  }

  @Test
  void getTermsStripsBlanksAndNulls() {
    // Pre-create iterables BEFORE any when() chain
    DistinctIterable<String> empty = makeIterable(new ArrayList<>());
    DistinctIterable<String> withBlanks = makeIterable(Arrays.asList("", null, "  ", "Crayon"));

    // Default: all distinct() calls return empty iterable to avoid NPE
    when(supplyListCollection.distinct(any(String.class), eq(String.class))).thenReturn(empty);
    when(inventoryCollection.distinct(any(String.class), eq(String.class))).thenReturn(empty);

    // Override supplyList "item" to include blanks/nulls (registered after the default, so it wins)
    when(supplyListCollection.distinct(eq("item"), eq(String.class))).thenReturn(withBlanks);

    doAnswer(inv -> {
      Terms terms = inv.getArgument(0);
      assertTrue(terms.item.containsAll(List.of("Construction Paper", "Crayon")));
      assertFalse(terms.item.contains(""));
      return null;
    }).when(ctx).json(any(Terms.class));

    controller.getTerms(ctx);
    verify(ctx).json(any(Terms.class));
    verify(ctx).status(eq(HttpStatus.OK));
  }

  @Test
  void getTermsKeepsPencilMarkersInTheirCanonicalTypeField() {
    DistinctIterable<String> empty = makeIterable(new ArrayList<>());
    DistinctIterable<String> sizeFromInventory = makeIterable(Arrays.asList("#2"));
    DistinctIterable<String> typeFromInventory = makeIterable(Arrays.asList("#2", "Sharpened"));

    when(supplyListCollection.distinct(any(String.class), eq(String.class))).thenReturn(empty);
    when(inventoryCollection.distinct(any(String.class), eq(String.class))).thenReturn(empty);

    when(inventoryCollection.distinct(eq("size"), eq(String.class))).thenReturn(sizeFromInventory);
    when(inventoryCollection.distinct(eq("type"), eq(String.class))).thenReturn(typeFromInventory);

    doAnswer(inv -> {
      Terms terms = inv.getArgument(0);
      assertFalse(terms.size.contains("#2"));
      assertTrue(terms.type.contains("#2"));
      assertTrue(terms.type.contains("Sharpened"));
      return null;
    }).when(ctx).json(any(Terms.class));

    controller.getTerms(ctx);
    verify(ctx).json(any(Terms.class));
    verify(ctx).status(eq(HttpStatus.OK));
  }

  @Test
  void getTermsDoesNotPromoteAliasesOrUnknownStoredTerms() {
    DistinctIterable<String> empty = makeIterable(new ArrayList<>());
    DistinctIterable<String> items = makeIterable(List.of("glue sticks", "backpack", "Custom Classroom Kit"));
    DistinctIterable<String> sizes = makeIterable(List.of("1 inch"));

    when(supplyListCollection.distinct(any(String.class), eq(String.class))).thenReturn(empty);
    when(inventoryCollection.distinct(any(String.class), eq(String.class))).thenReturn(empty);
    when(inventoryCollection.distinct(eq("item"), eq(String.class))).thenReturn(items);
    when(inventoryCollection.distinct(eq("size"), eq(String.class))).thenReturn(sizes);

    doAnswer(inv -> {
      Terms terms = inv.getArgument(0);
      assertTrue(terms.item.contains("Glue Stick"));
      assertFalse(terms.item.contains("glue sticks"));
      assertTrue(terms.item.contains("Backpack"));
      assertFalse(terms.item.contains("backpack"));
      assertFalse(terms.item.contains("Custom Classroom Kit"));
      assertTrue(terms.size.contains("1 in"));
      assertFalse(terms.size.contains("1 inch"));
      return null;
    }).when(ctx).json(any(Terms.class));

    controller.getTerms(ctx);
    verify(ctx).status(eq(HttpStatus.OK));
  }

}
