package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"gorm.io/datatypes"
)

type SpaceHandler struct {
	svc        service.SpaceService
	coreClient *httpclient.CoreClient
}

func NewSpaceHandler(s service.SpaceService, coreClient *httpclient.CoreClient) *SpaceHandler {
	return &SpaceHandler{
		svc:        s,
		coreClient: coreClient,
	}
}

type CreateSpaceReq struct {
	Configs map[string]interface{} `form:"configs" json:"configs"`
}

type GetSpacesReq struct {
	Limit    int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor   string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// GetSpaces godoc
//
//	@Summary		Get spaces
//	@Description	Get all spaces under a project
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			limit		query	integer	false	"Limit of spaces to return, default 20. Max 200."
//	@Param			cursor		query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			time_desc	query	string	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListSpacesOutput}
//	@Router			/space [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List spaces\nspaces = client.spaces.list(limit=20, time_desc=True)\nfor space in spaces.items:\n    print(f\"{space.id}: {space.configs}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List spaces\nconst spaces = await client.spaces.list({ limit: 20, timeDesc: true });\nfor (const space of spaces.items) {\n  console.log(`${space.id}: ${JSON.stringify(space.configs)}`);\n}\n","label":"JavaScript"}]
func (h *SpaceHandler) GetSpaces(c *gin.Context) {
	req := GetSpacesReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	out, err := h.svc.List(c.Request.Context(), service.ListSpacesInput{
		ProjectID: project.ID,
		Limit:     req.Limit,
		Cursor:    req.Cursor,
		TimeDesc:  req.TimeDesc,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}

// CreateSpace godoc
//
//	@Summary		Create space
//	@Description	Create a new space under a project
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			payload	body	handler.CreateSpaceReq	true	"CreateSpace payload"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Space}
//	@Router			/space [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Create a space\nspace = client.spaces.create(configs={\"name\": \"My Space\"})\nprint(f\"Created space: {space.id}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Create a space\nconst space = await client.spaces.create({ configs: { name: 'My Space' } });\nconsole.log(`Created space: ${space.id}`);\n","label":"JavaScript"}]
func (h *SpaceHandler) CreateSpace(c *gin.Context) {
	req := CreateSpaceReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	space := model.Space{
		ProjectID: project.ID,
		Configs:   datatypes.JSONMap(req.Configs),
	}
	if err := h.svc.Create(c.Request.Context(), &space); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: space})
}

// DeleteSpace godoc
//
//	@Summary		Delete space
//	@Description	Delete a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id} [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Delete a space\nclient.spaces.delete(space_id='space-uuid')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Delete a space\nawait client.spaces.delete('space-uuid');\n","label":"JavaScript"}]
func (h *SpaceHandler) DeleteSpace(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), project.ID, spaceID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type UpdateSpaceConfigsReq struct {
	Configs map[string]interface{} `form:"configs" json:"configs" binding:"required"`
}

// UpdateConfigs godoc
//
//	@Summary		Update space configs
//	@Description	Update the configurations of a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string							true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			payload		body	handler.UpdateSpaceConfigsReq	true	"UpdateConfigs payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/configs [put]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Update space configs\nclient.spaces.update_configs(\n    space_id='space-uuid',\n    configs={\"name\": \"Updated Name\", \"description\": \"New description\"}\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Update space configs\nawait client.spaces.updateConfigs('space-uuid', {\n  configs: { name: 'Updated Name', description: 'New description' }\n});\n","label":"JavaScript"}]
func (h *SpaceHandler) UpdateConfigs(c *gin.Context) {
	req := UpdateSpaceConfigsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	if err := h.svc.UpdateByID(c.Request.Context(), &model.Space{
		ID:      spaceID,
		Configs: datatypes.JSONMap(req.Configs),
	}); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

// GetConfigs godoc
//
//	@Summary		Get space configs
//	@Description	Retrieve the configurations of a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.Space}
//	@Router			/space/{space_id}/configs [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get space configs\nspace = client.spaces.get_configs(space_id='space-uuid')\nprint(space.configs)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get space configs\nconst space = await client.spaces.getConfigs('space-uuid');\nconsole.log(space.configs);\n","label":"JavaScript"}]
func (h *SpaceHandler) GetConfigs(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	space, err := h.svc.GetByID(c.Request.Context(), &model.Space{ID: spaceID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: space})
}

type GetExperienceSearchReq struct {
	Query             string   `form:"query" json:"query" binding:"required"`
	Limit             int      `form:"limit,default=10" json:"limit" binding:"omitempty,min=1,max=50"`
	Mode              string   `form:"mode,default=fast" json:"mode" binding:"omitempty,oneof=fast agentic"`
	SemanticThreshold *float64 `form:"semantic_threshold" json:"semantic_threshold" binding:"omitempty,min=0,max=2"`
	MaxIterations     int      `form:"max_iterations,default=16" json:"max_iterations" binding:"omitempty,min=1,max=100"`
}

// GetExperienceSearch godoc
//
//	@Summary		Get experience search
//	@Description	Retrieve the experience search results for a given query within a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id			path	string	true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			query				query	string	true	"Search query for page/folder titles"
//	@Param			limit				query	int		false	"Maximum number of results to return (1-50, default 10)"
//	@Param			mode				query	string	false	"Search mode: fast or agentic (default fast)"
//	@Param			semantic_threshold	query	float64	false	"Cosine distance threshold (0=identical, 2=opposite)"
//	@Param			max_iterations		query	int		false	"Maximum number of iterations for agentic search (1-100, default 16)"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=httpclient.SpaceSearchResult}
//	@Router			/space/{space_id}/experience_search [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Experience search\nresult = client.spaces.experience_search(\n    space_id='space-uuid',\n    query='How to implement authentication?',\n    limit=10,\n    mode='agentic',\n    max_iterations=20\n)\nfor block in result.cited_blocks:\n    print(f\"{block.title} (distance: {block.distance})\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Experience search\nconst result = await client.spaces.experienceSearch('space-uuid', {\n  query: 'How to implement authentication?',\n  limit: 10,\n  mode: 'agentic',\n  maxIterations: 20\n});\nfor (const block of result.cited_blocks) {\n  console.log(`${block.title} (distance: ${block.distance})`);\n}\n","label":"JavaScript"}]
func (h *SpaceHandler) GetExperienceSearch(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := GetExperienceSearchReq{
		Limit:         10,
		Mode:          "fast",
		MaxIterations: 16,
	}
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Call core service
	result, err := h.coreClient.ExperienceSearch(c.Request.Context(), project.ID, spaceID, httpclient.ExperienceSearchRequest{
		Query:             req.Query,
		Limit:             req.Limit,
		Mode:              req.Mode,
		SemanticThreshold: req.SemanticThreshold,
		MaxIterations:     req.MaxIterations,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "Failed to call core service", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: result})
}

type ListExperienceConfirmationsReq struct {
	Limit    int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor   string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// ListExperienceConfirmations godoc
//
//	@Summary		Get experience confirmations
//	@Description	Get all experience confirmations in a space with cursor-based pagination
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			limit		query	integer	false	"Limit of confirmations to return, default 20. Max 200."
//	@Param			cursor		query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			time_desc	query	boolean	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListExperienceConfirmationsOutput}
//	@Router			/space/{space_id}/experience_confirmations [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get unconfirmed experiences\nexperiences = client.spaces.get_unconfirmed_experiences(\n    space_id='space-uuid',\n    limit=20,\n    time_desc=True\n)\nfor experience in experiences.items:\n    print(f\"{experience.id}: {experience.experience_data}\")\n\n# If there are more, use the cursor for pagination\nif experiences.has_more:\n    next_experiences = client.spaces.get_unconfirmed_experiences(\n        space_id='space-uuid',\n        limit=20,\n        cursor=experiences.next_cursor\n    )\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get unconfirmed experiences\nconst experiences = await client.spaces.getUnconfirmedExperiences('space-uuid', {\n  limit: 20,\n  timeDesc: true\n});\nfor (const experience of experiences.items) {\n  console.log(`${experience.id}: ${JSON.stringify(experience.experience_data)}`);\n}\n\n// If there are more, use the cursor for pagination\nif (experiences.hasMore) {\n  const nextExperiences = await client.spaces.getUnconfirmedExperiences('space-uuid', {\n    limit: 20,\n    cursor: experiences.nextCursor\n  });\n}\n","label":"JavaScript"}]
func (h *SpaceHandler) ListExperienceConfirmations(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := ListExperienceConfirmationsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Verify the space belongs to the project
	space, err := h.svc.GetByID(c.Request.Context(), &model.Space{ID: spaceID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}
	if space.ProjectID != project.ID {
		c.JSON(http.StatusForbidden, serializer.ParamErr("", errors.New("space does not belong to project")))
		return
	}

	out, err := h.svc.ListExperienceConfirmations(c.Request.Context(), service.ListExperienceConfirmationsInput{
		SpaceID:  spaceID,
		Limit:    req.Limit,
		Cursor:   req.Cursor,
		TimeDesc: req.TimeDesc,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}

type ConfirmExperienceReq struct {
	Save *bool `form:"save" json:"save" binding:"required"`
}

// ConfirmExperience godoc
//
//	@Summary		Confirm experience
//	@Description	Confirm an experience confirmation. If save is false, delete the row. If save is true, get the data first (TODO: process data), then delete the row.
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id		path	string					true	"Space ID"						Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			experience_id	path	string					true	"Experience Confirmation ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			request			body	ConfirmExperienceReq	true	"Confirmation request with save flag"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.ExperienceConfirmation}
//	@Router			/space/{space_id}/experience_confirmations/{experience_id} [patch]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Confirm experience and save data\nconfirmation = client.spaces.confirm_experience(\n    space_id='space-uuid',\n    experience_id='experience-uuid',\n    save=True\n)\nprint(f\"Saved confirmation: {confirmation.experience_data}\")\n\n# Confirm experience without saving (just delete)\nclient.spaces.confirm_experience(\n    space_id='space-uuid',\n    experience_id='experience-uuid',\n    save=False\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Confirm experience and save data\nconst confirmation = await client.spaces.confirmExperience('space-uuid', 'experience-uuid', {\n  save: true\n});\nconsole.log(`Saved confirmation: ${JSON.stringify(confirmation.experience_data)}`);\n\n// Confirm experience without saving (just delete)\nawait client.spaces.confirmExperience('space-uuid', 'experience-uuid', {\n  save: false\n});\n","label":"JavaScript"}]
func (h *SpaceHandler) ConfirmExperience(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	experienceID, err := uuid.Parse(c.Param("experience_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := ConfirmExperienceReq{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Verify the space belongs to the project
	space, err := h.svc.GetByID(c.Request.Context(), &model.Space{ID: spaceID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}
	if space.ProjectID != project.ID {
		c.JSON(http.StatusForbidden, serializer.ParamErr("", errors.New("space does not belong to project")))
		return
	}

	confirmation, err := h.svc.ConfirmExperience(c.Request.Context(), spaceID, experienceID, *req.Save)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: confirmation})
}
