import express from 'express';
import Project from '../models/Project.js';
import { isAuthenticated } from '../auth/auth.js';

const router = express.Router();

// Create a new project
router.post('/create', isAuthenticated, async (req, res) => {
    const { name, description } = req.body;
    const owner = req.user.id;

    if (!name || !description) {
        return res.status(400).json({ message: 'Project name and description are required' });
    }

    try {
        const newProject = new Project({ name, owner, description });
        await newProject.save();
        res.status(201).json({ message: 'Project created successfully', project: newProject });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ message: 'Error creating project', error: error.message });
    }
});

// Update a project
router.put('/update/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !description) {
        return res.status(400).json({ message: 'Project name and description are required' });
    }

    try {
        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        project.name = name;
        project.description = description;
        await project.save();

        res.status(200).json({ message: 'Project updated successfully', project });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'Error updating project', error: error.message });
    }
});

// Fetch all projects
router.get('/list', isAuthenticated, async (req, res) => {
    try {
        const projects = await Project.find({ owner: req.user.id });
        res.status(200).json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Error fetching projects', error: error.message });
    }
});

// Fetch project details by ID
router.get('/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.status(200).json(project);
    } catch (error) {
        console.error('Error fetching project details:', error);
        res.status(500).json({ message: 'Error fetching project details', error: error.message });
    }
});


//add a new route to delete a project

router.delete('/delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const project = await Project
            .findByIdAndDelete(id)
            .exec();

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Error deleting project', error: error.message });
    }



});


export default router;
