package store

import "memos/utils"

type Resource struct {
	Id        string `json:"id"`
	UserId    string `json:"userId"`
	Filename  string `json:"filename"`
	Blob      []byte `json:"blob"`
	Type      string `json:"type"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"`
}

func CreateResource(userId string, filename string, blob []byte, filetype string, size int64) (Resource, error) {
	newResource := Resource{
		Id:        utils.GenUUID(),
		UserId:    userId,
		Filename:  filename,
		Blob:      blob,
		Type:      filetype,
		Size:      size,
		CreatedAt: utils.GetNowDateTimeStr(),
	}

	query := `INSERT INTO resources (id, user_id, filename, blob, type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, newResource.Id, newResource.UserId, newResource.Filename, newResource.Blob, newResource.Type, newResource.Size, newResource.CreatedAt)

	return newResource, err
}

func GetResourcesByUserId(userId string) ([]Resource, error) {
	query := `SELECT id, filename, type, size, created_at FROM resources WHERE user_id=?`
	rows, _ := DB.Query(query, userId)
	defer rows.Close()

	resources := []Resource{}

	for rows.Next() {
		resource := Resource{}
		rows.Scan(&resource.Id, &resource.Filename, &resource.Type, &resource.Size, &resource.CreatedAt)
		resources = append(resources, resource)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return resources, nil
}

func GetResourceByIdAndFilename(id string, filename string) (Resource, error) {
	query := `SELECT id, filename, blob, type, size FROM resources WHERE id=? AND filename=?`
	resource := Resource{}
	err := DB.QueryRow(query, id, filename).Scan(&resource.Id, &resource.Filename, &resource.Blob, &resource.Type, &resource.Size)
	return resource, err
}

func DeleteResourceById(id string) error {
	query := `DELETE FROM resources WHERE id=?`
	_, err := DB.Exec(query, id)
	return err
}
