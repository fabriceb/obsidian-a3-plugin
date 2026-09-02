// Kept in sync with a3template.md in the a3-problem-solving-markdown-editor repo.
export const A3_TEMPLATE = `# A3 [Problem/Project Name] - Date: [MM/DD/YYYY] - Team: [List of contributors]


## 1. **Background**
Provide context for the problem or opportunity. Why is this important? What is the business impact?

- [Explain the relevance and background of the issue]
- [Describe how it connects to organizational goals]
- [Include any historical context, previous efforts, or key events]

\`\`\`mermaid
---
config:
    xyChart:
        width: 500
        height: 300
        titleFontSize: 12
        xAxis:
            labelFontSize: 8
            titleFontSize: 8
        yAxis:
            labelFontSize: 8
            titleFontSize: 8
    themeVariables:
        xyChart:
            plotColorPalette: "#c3d5ec,#ff0000"


---
xychart-beta
    title "Gap to Standard"
    x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
    y-axis "Revenue (in $)" 4000 --> 11000
    bar [8000, 7800, 8500, 9200, 9500, 10500, 10000, 10200, 9200, 8500, 7000, 6000]
    line [9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000]
\`\`\`

## 2. **Current Condition**
Describe the present situation using data, visuals, or diagrams (e.g., process maps, graphs, charts).

- [Outline the current state of the process, problem, or challenge]
- [Include quantitative and qualitative data]
- [Use visuals to illustrate the problem, if applicable]


## 3. **Target Condition**
Define the desired future state and goals.

- [What does success look like?]
- [Describe measurable objectives]
- [Provide a timeline for achieving improvements]


## 4. **Problem Analysis**
Identify the root causes of the issue using techniques such as the *5 Whys* or Fishbone Diagram.

- [Break down the problem into key factors]
- [Analyze root causes systematically]
- [Ensure the problem statement is clear and specific]

\`\`\`mermaid


%%{init: {'themeVariables': {'fontSize': '1em'}, 'flowchart': {'nodeSpacing': 20, 'rankSpacing': 20, 'padding': 0, 'diagramPadding': 0}}}%%

graph RL;
    A[Effect / Problem] -->|Cause Category 1| B
    A -->|Cause Category 2| C

    B -->|Sub Cause 1| B1
    B -->|Sub Cause 2| B2
    B -->|Sub Cause 3| B3

    C -->|Sub Cause 1| C1
    C -->|Sub Cause 2| C2
    C -->|Sub Cause 3| C3

\`\`\`


## 5. **Countermeasures**
List proposed solutions to address root causes and move toward the target condition.

| Countermeasure | Expected Impact | Owner | Due Date |
|---------------|----------------|-------|---------|
| [Solution 1]  | [Impact]        | [Owner] | [Date] |
| [Solution 2]  | [Impact]        | [Owner] | [Date] |
| [Solution 3]  | [Impact]        | [Owner] | [Date] |


## 6. **Implementation Plan**
Define actionable steps to execute the countermeasures.

- [List tasks, responsibilities, and deadlines]
- [Identify resources needed]
- [Specify how progress will be tracked and measured]


## 7. **Follow-Up & Adjustments**
Monitor results, assess effectiveness, and determine next steps.

- [Describe how results will be measured]
- [Identify risks or obstacles]
- [Plan for necessary adaptations or next iterations]
`;
