// Packages
package umm3601.Inventory;

// Org Imports
import org.mongojack.Id;
import org.mongojack.ObjectId;
// Java Imports
import java.util.List;

// Inventory Class
@SuppressWarnings({"VisibilityModifier"})
public class Inventory {

  @ObjectId @Id
  @SuppressWarnings({"MemberName"})
  public String _id;

  public String item;
  public String brand;
  public int packageSize;
  public String size;
  public String color;
  public String type;
  public String material;
  public String description;
  public int quantity;
  public int maxQuantity;
  public int minQuantity;
  public Integer calculatedMinQuantity;
  public String stockState; // "Stocked", "Understocked", "Overstocked", "Out of Stock"
  public String calculatedStockState; // "Stocked", "Understocked", "Overstocked", "Unknown"
  public String notes;
  public String internalID;
  public String internalBarcode;
  public List<String> externalBarcode;
  public int reservedQuantity; // Stock promised to a student

  @Override
  public boolean equals(Object obj) {
    if (!(obj instanceof Inventory)) {
      return false;
    }
    Inventory other = (Inventory) obj;
    return _id != null && _id.equals(other._id);
  }

  @Override
  public int hashCode() {
    return _id == null ? 0 : _id.hashCode();
  }

  public String buildDescription() {
    return InventoryDescriptionBuilder.build(this);
  }

  public void refreshDescription() {
    this.description = buildDescription();
  }

  @Override
  public String toString() {
    return buildDescription();
  }
}
