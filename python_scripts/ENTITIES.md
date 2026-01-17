---

### **1. The Skeleton: Lines and Curves**

These entities form the physical geometry of your drawing (walls, boundaries, roads, reinforcement bars).

#### **LINE**

* **What it is:** A single straight line segment between two points in 3D space.
* **Civil Use:** Property lines, grid lines, simple beams, or truss members.
* **Attributes:**
* **Start Point ():** Where the line begins.
* **End Point ():** Where the line ends.
* **Thickness:** (Optional) 3D thickness.



#### **LWPOLYLINE (Lightweight Polyline)**

* **What it is:** A 2D-only sequence of connected line and arc segments. It is "Lightweight" because it is stored as a single object database entry, making it more efficient than the older `POLYLINE`.
* **Civil Use:** This is the most common entity. Used for **plot boundaries**, **building footprints**, **road curbs**, and **contour lines**.
* **Attributes:**
* **Vertices:** A list of 2D coordinates ().
* **Bulge:** A factor indicating if a segment is straight or curved (arc).
* **Elevation:** Since it's 2D, it has a single Z-value (height) for the whole line.
* **Closed/Open:** Boolean flag indicating if the shape forms a loop (like a plot boundary).



#### **POLYLINE**

* **What it is:** The older version of a polyline, or a 3D polyline. Unlike `LWPOLYLINE`, it can navigate 3D space (vertices can have different Z-values).
* **Civil Use:** **3D Terrain meshes**, surveying paths that change elevation, or legacy drawings.
* **Attributes:**
* **Vertices:** A list of 3D coordinates ().
* **Polyface Mesh flags:** Indicates if it's a wireframe or a mesh surface.



#### **CIRCLE & ARC**

* **What they are:** Simple curved geometry.
* **Civil Use:**
* **Circle:** Columns (RCC), manholes, wells.
* **Arc:** Door swings, curved road fillets, culvert arches.


* **Attributes:**
* **Center Point ():** The anchor.
* **Radius:** The distance from the center.
* **Start/End Angle (Arc only):** Defines the sweep of the curve.



#### **ELLIPSE**

* **What it is:** A circle stretched along one axis.
* **Civil Use:** Less common in 2D plans, but used for isometric views of circular pipes or architectural features.
* **Attributes:**
* **Center Point.**
* **Major Axis Endpoint:** Defines the length and rotation.
* **Axis Ratio:** Ratio of minor axis to major axis.



#### **SOLID**

* **What it is:** A solid-filled triangle or quadrilateral.
* **Civil Use:** Simple filled markers, arrowheads, or column fills (though `HATCH` is preferred now).
* **Attributes:**
* **Four points:** Corners of the shape. If only three are used, the 3rd and 4th are the same.



---

### **2. The Information: Annotations**

These entities add meaning, measurements, and labels to the geometry.

#### **TEXT & MTEXT**

* **What they are:**
* **TEXT:** Single-line text. Simple, no formatting.
* **MTEXT (Multiline Text):** Paragraph text with formatting (bold, underline, fonts).


* **Civil Use:**
* **TEXT:** Room names ("BEDROOM"), Grid numbers, Street names.
* **MTEXT:** General notes ("All dimensions in mm"), Construction specs, Disclaimers.


* **Attributes:**
* **Insertion Point:** Where the text sits.
* **Height:** Text size.
* **Rotation:** Angle of the text.
* **Value/String:** The actual words written.



#### **DIMENSION**

* **What it is:** Graphic entity showing measurements.
* **Civil Use:** Distances between columns, room sizes, plot dimensions.
* **Attributes:**
* **Definition Points:** Points being measured.
* **Text value:** The measured number (usually calculated automatically).
* **Type:** Linear, Aligned, Angular, or Radial.



#### **LEADER & MULTILEADER**

* **What they are:** An arrowhead attached to a line, leading to text. `MULTILEADER` is the modern, more flexible version.
* **Civil Use:** Pointing out specific details, e.g., "12mm dia bars @ 150mm c/c" or "Proposed Septic Tank."
* **Attributes:**
* **Vertices:** The path of the leader line.
* **Arrowhead type:** (e.g., Closed filled, Dot).
* **Content:** The text or block attached to it.



---

### **3. The Texture: Fills and Symbols**

#### **HATCH**

* **What it is:** A pattern filling an enclosed area.
* **Civil Use:** To distinguish materials.
* *Diagonal lines:* Brickwork.
* *Triangles/Dots:* Concrete.
* *Solid fill:* Columns or Walls.


* **Attributes:**
* **Pattern Name:** (e.g., ANSI31, CONCRETE).
* **Scale & Angle:** Size and rotation of the pattern.
* **Boundary:** The loops (lines/polylines) that define the fill area.



#### **INSERT**

* **What it is:** This is very important. An `INSERT` entity is an instance of a **Block**. It is a reference to a definition stored elsewhere in the file.
* **Civil Use:** Repeating symbols like **North Arrows**, **Doors**, **Windows**, **Tree symbols**, or **Furniture**. Instead of drawing 100 separate toilets, you "Insert" the Toilet block 100 times.
* **Attributes:**
* **Block Name:** Which block definition to use.
* **Insertion Point:**  location.
* **Scale Factors ():** How much to stretch it.
* **Rotation:** Angle.



---

### **4. System & Layout Entities**

These manage how the data is viewed or integrated with other software.

#### **VIEWPORT**

* **What it is:** A window in the "Layout" (Paper Space) that looks into the "Model" (Model Space).
* **Civil Use:** Setting up the drawing for printing. One viewport might show the whole site plan at 1:100, while another shows a detail at 1:20.
* **Attributes:**
* **Center point, Width, Height:** Size of the window.
* **View Target/Direction:** What part of the model it's looking at.
* **Scale:** The zoom level (e.g., 1/100XP).



#### **OLE2FRAME (Object Linking and Embedding)**

* **What it is:** A frame containing an object from another program, like an Excel table (Schedule of Bars) or a Word document embedded inside the CAD file.
* **Civil Use:** Bill of Quantities (BOQ) or Bar Bending Schedules (BBS) pasted directly from Excel.
* **Attributes:**
* **Binary Data:** The raw data of the embedded file.
* **Bounds:** The rectangle box containing the object.
* *Note: These often break when converting DXF to other formats (like GIS or web viewers).*



---

### **Summary Table for Quick Reference**

| Entity | Primary Attribute Data | Typical Civil Use |
| --- | --- | --- |
| **LWPOLYLINE** | Vertex List (), Elevation | Plot boundaries, Contours, Walls |
| **LINE** | Start (), End () | Grid lines, Simple geometry |
| **INSERT** | Block Name, Insert Point (), Rotation | Doors, Windows, Symbols |
| **MTEXT** | String, Insert Point, Height | Notes, Specifications |
| **DIMENSION** | Measurement points, Text | Room sizes, Site measurements |
| **HATCH** | Pattern Name, Boundary path | Material indication (Concrete/Brick) |
