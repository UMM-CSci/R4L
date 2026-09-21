package umm3601.Inventory;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class InventoryDescriptionBuilderSpec {
  private static final int PACK_SIZE = 24;

  @Test
  void doesNotRepeatMaterialAlreadyInCompleteItemName() {
    Inventory inventory = new Inventory();
    inventory.item = "Construction Paper";
    inventory.material = "Paper";
    assertEquals("Construction Paper", inventory.buildDescription());
  }

  @Test
  void formatsLegacyGlueStickWithSizeBeforeItem() {
    Inventory inventory = new Inventory();
    inventory.item = "Glue";
    inventory.type = "Stick";
    inventory.size = "Large";
    inventory.brand = "Elmer's";
    assertEquals("Elmer's Large Glue Stick", inventory.buildDescription());
  }

  @Test
  void pluralizesItemsInPacks() {
    Inventory inventory = new Inventory();
    inventory.item = "Glue Stick";
    inventory.packageSize = PACK_SIZE;
    assertEquals("24 Pack of Glue Sticks", inventory.buildDescription());
  }

  @Test
  void preservesIndependentMaterial() {
    Inventory inventory = new Inventory();
    inventory.item = "Folder";
    inventory.color = "Red";
    inventory.material = "Plastic";
    assertEquals("Red Folder (Plastic)", inventory.buildDescription());
  }
}
