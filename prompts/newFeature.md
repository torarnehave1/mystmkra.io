Here's a prompt you could use to guide the refactoring process:

---

**Refactoring and Feature Integration Prompt**

"Please refactor the code to implement the new AI-based step generation feature, ensuring that the current functionality remains completely intact. The refactoring should adhere to these guidelines:

1. **Preserve Existing Functionality:**  
   - Do not modify any existing functions, method signatures, or logic that the current application relies on.
   - Maintain the current folder and file structure wherever possible.

2. **Isolated Integration:**  
   - Implement the new feature in new modules or functions, integrating them via well-defined interfaces without altering the legacy code.
   - Ensure that the new code is only triggered by its specific callback (e.g., 'add_steps_ai_').

3. **Backward Compatibility:**  
   - Introduce unit and integration tests for the new functionality without affecting existing test coverage.
   - Validate that the manual process creation and other features continue to operate as expected.

4. **Version Control Practices:**  
   - Work on a separate branch to allow thorough testing and review before merging into the main codebase.
   - Document all changes and provide clear commit messages for transparency.

5. **Documentation and Comments:**  
   - Add comments and documentation specifically for the new feature to aid future maintenance.
   - Ensure that the new AI integration is clearly distinguishable from the existing logic.

Following these instructions will help ensure that the existing code remains intact while successfully integrating the new AI-based process step generation feature."

---

Feel free to modify this prompt to better match your team's workflow or specific project needs.